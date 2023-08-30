import {
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  InterfaceTypeDefinitionNode,
  Kind,
  Location,
  NameNode,
  ObjectTypeDefinitionNode,
  visit,
} from "graphql";
import * as ts from "typescript";
import {
  DiagnosticResult,
  DiagnosticsResult,
  err,
  FAKE_ERROR_CODE,
  ok,
} from "./utils/DiagnosticError";
import { getRelativeOutputPath } from "./gratsRoot";
import { EXPORTED_DIRECTIVE } from "./serverDirectives";
import { FIELD_TAG, INTERFACE_TAG, TYPE_TAG } from "./Extractor";
import * as E from "./Errors";

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

type NameDefinition = {
  name: NameNode;
  kind: "TYPE" | "INTERFACE" | "UNION" | "SCALAR" | "INPUT_OBJECT" | "ENUM";
};

// Grats can't always extract an SDL AST node right away. In some cases, it
// needs to extract something abstract which can only be converted into an SDL
// AST after the whole program has been analyzed.
export type GratsDefinitionNode = DefinitionNode | AbstractFieldDefinitionNode;

// A field definition that applies to some construct. We don't yet know if it applies to
// a concrete type, or an interface.
export type AbstractFieldDefinitionNode = {
  readonly kind: "AbstractFieldDefinition";
  readonly loc: Location;
  readonly onType: NameNode;
  readonly field: FieldDefinitionNode;
};

/**
 * Used to track TypeScript references.
 *
 * If a TS method is typed as returning `MyType`, we need to look at that type's
 * GQLType annotation to find out its name. However, we may not have seen that
 * class yet.
 *
 * So, we employ a two pass approach. When we encounter a reference to a type
 * we model it as a dummy type reference in the GraphQL AST. Then, after we've
 * parsed all the files, we traverse the GraphQL schema, resolving all the dummy
 * type references.
 */
export class TypeContext {
  checker: ts.TypeChecker;
  host: ts.CompilerHost;

  _options: ts.ParsedCommandLine;
  _symbolToName: Map<ts.Symbol, NameDefinition> = new Map();
  _unresolvedTypes: Map<NameNode, ts.Symbol> = new Map();
  hasTypename: Set<string> = new Set();

  constructor(
    options: ts.ParsedCommandLine,
    checker: ts.TypeChecker,
    host: ts.CompilerHost,
  ) {
    this._options = options;
    this.checker = checker;
    this.host = host;
  }

  recordTypeName(node: ts.Node, name: NameNode, kind: NameDefinition["kind"]) {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      // FIXME: Make this a diagnostic
      throw new Error(
        "Could not resolve type reference. You probably have a TypeScript error.",
      );
    }
    if (this._symbolToName.has(symbol)) {
      // Ensure we never try to record the same name twice.
      throw new Error("Unexpected double recording of typename.");
    }
    this._symbolToName.set(symbol, { name, kind });
  }

  recordHasTypenameField(name: string) {
    this.hasTypename.add(name);
  }

  markUnresolvedType(node: ts.Node, name: NameNode) {
    let symbol = this.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      //
      throw new Error(
        "Could not resolve type reference. You probably have a TypeScript error.",
      );
    }

    if (symbol.flags & ts.SymbolFlags.Alias) {
      // Follow any aliases to get the real type declaration.
      symbol = this.checker.getAliasedSymbol(symbol);
    }

    this._unresolvedTypes.set(name, symbol);
  }

  resolveTypes(doc: DocumentNode): DiagnosticsResult<DocumentNode> {
    const errors: ts.Diagnostic[] = [];
    const newDoc = visit(doc, {
      [Kind.NAME]: (t) => {
        const namedTypeResult = this.resolveNamedType(t);
        if (namedTypeResult.kind === "ERROR") {
          errors.push(namedTypeResult.err);
          return t;
        }
        return namedTypeResult.value;
      },
    });
    if (errors.length > 0) {
      return err(errors);
    }
    return ok(newDoc);
  }

  addInterfaceImplementations(
    docs: GratsDefinitionNode[],
  ): DiagnosticsResult<DefinitionNode[]> {
    const newDocs: DefinitionNode[] = [];
    const errors: ts.Diagnostic[] = [];
    for (const doc of docs) {
      if (doc.kind === "AbstractFieldDefinition") {
        const typeNameResult = this.resolveNamedType(doc.onType);
        if (typeNameResult.kind === "ERROR") {
          errors.push(typeNameResult.err);
          continue;
        }
        const symbol = this._unresolvedTypes.get(doc.onType);
        if (symbol == null) {
          // This should have already been handled by resolveNamedType
          throw new Error("Expected to find unresolved type.");
        }
        const nameDefinition = this._symbolToName.get(symbol);
        if (nameDefinition == null) {
          // This should have already been handled by resolveNamedType
          throw new Error("Expected to find name definition.");
        }

        switch (nameDefinition.kind) {
          case "TYPE":
            // Extending a type, is just adding a field to it.
            newDocs.push({
              kind: Kind.OBJECT_TYPE_EXTENSION,
              name: doc.onType,
              fields: [doc.field],
            });
            break;
          case "INTERFACE": {
            // Extending an interface is a bit more complicated. We need to add the field
            // to the interface, and to each type that implements the interface.

            // The interface field definition is not executable, so we don't
            // need to annotate it with the details of the implementation.
            const directives = doc.field.directives?.filter((directive) => {
              return directive.name.value !== EXPORTED_DIRECTIVE;
            });
            newDocs.push({
              kind: Kind.INTERFACE_TYPE_EXTENSION,
              name: doc.onType,
              fields: [{ ...doc.field, directives }],
            });

            const isImplementor = (
              definition: DefinitionNode,
            ): definition is
              | ObjectTypeDefinitionNode
              | InterfaceTypeDefinitionNode => {
              // TODO: Is it possible that a type implements an interface via an extension?
              // `extend type Foo implements Bar { ... }`
              return (
                (definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
                  definition.kind === Kind.INTERFACE_TYPE_DEFINITION) &&
                definition.interfaces != null &&
                definition.interfaces.some((i) => {
                  const resolved = this.resolveNamedDefinition(i.name);
                  if (resolved.kind === "ERROR") {
                    throw new Error(
                      "Unexpected error resolving interface implementor.",
                    );
                  }
                  return resolved.value.value === nameDefinition.name.value;
                })
              );
            };

            // TODO: This is inefficient, `O(definition count * field definition)`. We could start with a single pass
            // where we collect all the interface implementors, and then add them
            // to a map.
            const interfaceImplementors = docs.filter(isImplementor);

            for (const definition of interfaceImplementors) {
              switch (definition.kind) {
                case Kind.OBJECT_TYPE_DEFINITION:
                  newDocs.push({
                    kind: Kind.OBJECT_TYPE_EXTENSION,
                    name: definition.name,
                    fields: [doc.field],
                  });
                  break;
                case Kind.INTERFACE_TYPE_DEFINITION:
                  newDocs.push({
                    kind: Kind.INTERFACE_TYPE_EXTENSION,
                    name: definition.name,
                    fields: [{ ...doc.field, directives }],
                  });
                  break;
                default: {
                  const _: never = definition;
                  break;
                }
              }
            }
            break;
          }
          default: {
            // Extending any other type of definition is not supported.
            const loc = doc.onType.loc;
            if (loc == null) {
              throw new Error("Expected onType to have a location.");
            }
            const relatedLoc = nameDefinition.name.loc;
            if (relatedLoc == null) {
              throw new Error("Expected nameDefinition to have a location.");
            }

            errors.push(
              this.err(loc, E.invalidTypePassedToFieldFunction(), [
                this.relatedInformation(
                  relatedLoc,
                  `This is the type that was passed to \`@${FIELD_TAG}\`.`,
                ),
              ]),
            );
          }
        }
      } else {
        newDocs.push(doc);
      }
    }
    if (errors.length > 0) {
      return err(errors);
    }
    return ok(newDocs);
  }

  resolveNamedDefinition(unresolved: NameNode): DiagnosticResult<NameNode> {
    const symbol = this._unresolvedTypes.get(unresolved);
    if (symbol == null) {
      if (unresolved.value === UNRESOLVED_REFERENCE_NAME) {
        // This is a logic error on our side.
        throw new Error("Unexpected unresolved reference name.");
      }
      return ok(unresolved);
    }
    const nameDefinition = this._symbolToName.get(symbol);
    if (nameDefinition == null) {
      if (unresolved.loc == null) {
        throw new Error("Expected namedType to have a location.");
      }
      return err(this.err(unresolved.loc, E.unresolvedTypeReference()));
    }
    return ok({ ...unresolved, value: nameDefinition.name.value });
  }

  resolveNamedType(unresolved: NameNode): DiagnosticResult<NameNode> {
    const symbol = this._unresolvedTypes.get(unresolved);
    if (symbol == null) {
      if (unresolved.value === UNRESOLVED_REFERENCE_NAME) {
        // This is a logic error on our side.
        throw new Error("Unexpected unresolved reference name.");
      }
      return ok(unresolved);
    }
    const nameDefinition = this._symbolToName.get(symbol);
    if (nameDefinition == null) {
      if (unresolved.loc == null) {
        throw new Error("Expected namedType to have a location.");
      }
      return err(this.err(unresolved.loc, E.unresolvedTypeReference()));
    }
    return ok({ ...unresolved, value: nameDefinition.name.value });
  }

  err(
    loc: Location,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): ts.Diagnostic {
    return {
      messageText: message,
      start: loc.start,
      length: loc.end - loc.start,
      category: ts.DiagnosticCategory.Error,
      code: FAKE_ERROR_CODE,
      file: ts.createSourceFile(
        loc.source.name,
        loc.source.body,
        ts.ScriptTarget.Latest,
      ),
      relatedInformation,
    };
  }

  relatedInformation(
    loc: Location,
    message: string,
  ): ts.DiagnosticRelatedInformation {
    return {
      category: ts.DiagnosticCategory.Message,
      code: FAKE_ERROR_CODE,
      messageText: message,
      file: ts.createSourceFile(
        loc.source.name,
        loc.source.body,
        ts.ScriptTarget.Latest,
      ),
      start: loc.start,
      length: loc.end - loc.start,
    };
  }

  validateInterfaceImplementorsHaveTypenameField(): DiagnosticResult<null> {
    return ok(null);
  }

  getDestFilePath(sourceFile: ts.SourceFile): string {
    return getRelativeOutputPath(this._options, sourceFile);
  }
}
