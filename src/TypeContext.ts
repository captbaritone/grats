import {
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  Kind,
  Location,
  NameNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
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
import {
  ASYNC_ITERABLE_TYPE_DIRECTIVE as ASYNC_GENERATOR_DIRECTIVE,
  EXPORTED_DIRECTIVE,
} from "./metadataDirectives";
import { FIELD_TAG } from "./Extractor";
import * as E from "./Errors";
import { InterfaceMap, computeInterfaceMap } from "./InterfaceGraph";
import { extend } from "./utils/helpers";

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
 * Information about the GraphQL context type. We track the first value we see,
 * and then validate that any other values we see are the same.
 */
type GqlContext = {
  // If we follow the context type back to its source, this is the declaration
  // we find.
  declaration: ts.Node;

  // The first reference to the context type that we encountered. Used for
  // reporting errors if a different context type is encountered.
  firstReference: ts.Node;
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
  // The resolver context declaration, if it has been encountered.
  // Gets mutated by Extractor.
  gqlContext: GqlContext | null = null;
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
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      //
      throw new Error(
        "Could not resolve type reference. You probably have a TypeScript error.",
      );
    }

    this._unresolvedTypes.set(name, this.resolveSymbol(symbol));
  }

  findSymbolDeclaration(startSymbol: ts.Symbol): ts.Declaration | null {
    const symbol = this.resolveSymbol(startSymbol);
    const declaration = symbol.declarations?.[0];
    return declaration ?? null;
  }

  // Follow symbol aliases until we find the original symbol. Accounts for
  // cyclical aliases.
  resolveSymbol(startSymbol: ts.Symbol): ts.Symbol {
    let symbol = startSymbol;
    const visitedSymbols = new Set<ts.Symbol>();

    while (ts.SymbolFlags.Alias & symbol.flags) {
      if (visitedSymbols.has(symbol)) {
        throw new Error("Cyclical alias detected. Breaking resolution.");
      }

      visitedSymbols.add(symbol);
      symbol = this.checker.getAliasedSymbol(symbol);
    }
    return symbol;
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

  // Ensure that all fields on `Subscription` return an AsyncIterable, and that no other
  // fields do.
  validateAsyncIterableFields(doc: DocumentNode): DiagnosticsResult<void> {
    const errors: ts.Diagnostic[] = [];

    const visitNode = (
      t:
        | ObjectTypeDefinitionNode
        | ObjectTypeExtensionNode
        | InterfaceTypeDefinitionNode
        | InterfaceTypeExtensionNode,
    ) => {
      const validateFieldsResult = this.validateField(t);
      if (validateFieldsResult != null) {
        errors.push(validateFieldsResult);
      }
    };

    visit(doc, {
      [Kind.INTERFACE_TYPE_DEFINITION]: visitNode,
      [Kind.INTERFACE_TYPE_EXTENSION]: visitNode,
      [Kind.OBJECT_TYPE_DEFINITION]: visitNode,
      [Kind.OBJECT_TYPE_EXTENSION]: visitNode,
    });
    if (errors.length > 0) {
      return err(errors);
    }
    return ok(undefined);
  }
  validateField(
    t:
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode,
  ): ts.Diagnostic | void {
    if (t.fields == null) return;
    // Note: We assume the default name is used here. When custom operation types are supported
    // we'll need to update this.
    const isSubscription =
      t.name.value === "Subscription" &&
      (t.kind === Kind.OBJECT_TYPE_DEFINITION ||
        t.kind === Kind.OBJECT_TYPE_EXTENSION);
    for (const field of t.fields) {
      const asyncDirective = field.directives?.find(
        (directive) => directive.name.value === ASYNC_GENERATOR_DIRECTIVE,
      );

      if (isSubscription && asyncDirective == null) {
        if (field.type.loc == null) {
          throw new Error("Expected field type to have a location.");
        }
        return this.err(field.type.loc, E.subscriptionFieldNotAsyncIterable());
      }

      if (!isSubscription && asyncDirective != null) {
        if (asyncDirective.loc == null) {
          throw new Error("Expected asyncDirective to have a location.");
        }
        return this.err(
          asyncDirective.loc, // Directive location is the AsyncIterable type.
          E.nonSubscriptionFieldAsyncIterable(),
        );
      }
    }
  }

  // TODO: Is this still used?
  handleAbstractDefinitions(
    docs: GratsDefinitionNode[],
  ): DiagnosticsResult<DefinitionNode[]> {
    const newDocs: DefinitionNode[] = [];
    const errors: ts.Diagnostic[] = [];

    const interfaceGraphResult = computeInterfaceMap(this, docs);
    if (interfaceGraphResult.kind === "ERROR") {
      return interfaceGraphResult;
    }
    const interfaceGraph = interfaceGraphResult.value;

    for (const doc of docs) {
      if (doc.kind === "AbstractFieldDefinition") {
        const abstractDocResults = this.addAbstractFieldDefinition(
          doc,
          interfaceGraph,
        );
        if (abstractDocResults.kind === "ERROR") {
          extend(errors, abstractDocResults.err);
        } else {
          extend(newDocs, abstractDocResults.value);
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

  // A field definition may be on a concrete type, or on an interface. If it's on an interface,
  // we need to add it to each concrete type that implements the interface.
  addAbstractFieldDefinition(
    doc: AbstractFieldDefinitionNode,
    interfaceGraph: InterfaceMap,
  ): DiagnosticsResult<DefinitionNode[]> {
    const newDocs: DefinitionNode[] = [];
    const typeNameResult = this.resolveNamedType(doc.onType);
    if (typeNameResult.kind === "ERROR") {
      return err([typeNameResult.err]);
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
          loc: doc.loc,
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

        for (const implementor of interfaceGraph.get(
          nameDefinition.name.value,
        )) {
          const name = {
            kind: Kind.NAME,
            value: implementor.name,
            loc: doc.loc, // Bit of a lie, but I don't see a better option.
          } as const;
          switch (implementor.kind) {
            case "TYPE":
              newDocs.push({
                kind: Kind.OBJECT_TYPE_EXTENSION,
                name,
                fields: [doc.field],
                loc: doc.loc,
              });
              break;
            case "INTERFACE":
              newDocs.push({
                kind: Kind.INTERFACE_TYPE_EXTENSION,
                name,
                fields: [{ ...doc.field, directives }],
                loc: doc.loc,
              });
              break;
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

        return err([
          this.err(loc, E.invalidTypePassedToFieldFunction(), [
            this.relatedInformation(
              relatedLoc,
              `This is the type that was passed to \`@${FIELD_TAG}\`.`,
            ),
          ]),
        ]);
      }
    }
    return ok(newDocs);
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

  getDestFilePath(sourceFile: ts.SourceFile): string {
    return getRelativeOutputPath(this._options, sourceFile);
  }
}
