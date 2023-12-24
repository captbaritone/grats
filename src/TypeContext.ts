import { NameNode } from "graphql";
import * as ts from "typescript";
import {
  gqlErr,
  DiagnosticResult,
  DiagnosticsResult,
} from "./utils/DiagnosticError";
import { err, ok } from "./utils/Result";
import * as E from "./Errors";
import { ExtractionSnapshot } from "./Extractor";

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

export type NameDefinition = {
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

  _symbolToName: Map<ts.Symbol, NameDefinition> = new Map();
  _unresolvedTypes: Map<NameNode, ts.Symbol> = new Map();

  static fromSnapshot(
    checker: ts.TypeChecker,
    snapshot: ExtractionSnapshot,
  ): TypeContext {
    const self = new TypeContext(checker);
    for (const [node, typeName] of snapshot.unresolvedNames) {
      self._markUnresolvedType(node, typeName);
    }
    for (const [node, definition] of snapshot.nameDefinitions) {
      self._recordTypeName(node, definition.name, definition.kind);
    }
    return self;
  }

  constructor(checker: ts.TypeChecker) {
    this.checker = checker;
  }

  // Record that a GraphQL construct of type `kind` with the name `name` is
  // declared at `node`.
  _recordTypeName(node: ts.Node, name: NameNode, kind: NameDefinition["kind"]) {
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

  // Record that a type reference `node`
  _markUnresolvedType(node: ts.Node, name: NameNode) {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      //
      throw new Error(
        "Could not resolve type reference. You probably have a TypeScript error.",
      );
    }

    this._unresolvedTypes.set(name, this.resolveSymbol(symbol));
  }

  public findSymbolDeclaration(startSymbol: ts.Symbol): ts.Declaration | null {
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
      return err(gqlErr(unresolved.loc, E.unresolvedTypeReference()));
    }
    return ok({ ...unresolved, value: nameDefinition.name.value });
  }

  unresolvedNameIsGraphQL(unresolved: NameNode): boolean {
    const symbol = this._unresolvedTypes.get(unresolved);
    return symbol != null && this._symbolToName.has(symbol);
  }

  // TODO: Merge this with resolveNamedType
  getNameDefinition(nameNode: NameNode): DiagnosticsResult<NameDefinition> {
    const typeNameResult = this.resolveNamedType(nameNode);
    if (typeNameResult.kind === "ERROR") {
      return err([typeNameResult.err]);
    }
    const symbol = this._unresolvedTypes.get(nameNode);
    if (symbol == null) {
      // This should have already been handled by resolveNamedType
      throw new Error("Expected to find unresolved type.");
    }
    const nameDefinition = this._symbolToName.get(symbol);
    if (nameDefinition == null) {
      // This should have already been handled by resolveNamedType
      throw new Error("Expected to find name definition.");
    }
    return ok(nameDefinition);
  }
}
