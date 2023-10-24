import { DocumentNode, Kind, Location, NameNode, visit } from "graphql";
import * as ts from "typescript";
import {
  DiagnosticResult,
  DiagnosticsResult,
  err,
  FAKE_ERROR_CODE,
  ok,
} from "./utils/DiagnosticError";
import { getRelativeOutputPath } from "./gratsRoot";
import * as E from "./Errors";

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

type NameDefinition = {
  name: NameNode;
  kind: "TYPE" | "INTERFACE" | "UNION" | "SCALAR" | "INPUT_OBJECT" | "ENUM";
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
