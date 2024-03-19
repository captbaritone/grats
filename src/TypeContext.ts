import { NameNode } from "graphql";
import * as ts from "typescript";
import {
  gqlErr,
  DiagnosticResult,
  DiagnosticsResult,
  tsErr,
} from "./utils/DiagnosticError";
import { err, ok } from "./utils/Result";
import * as E from "./Errors";
import { ExtractionSnapshot } from "./Extractor";
import { loc } from "./utils/helpers";

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

export type NameDefinition = {
  name: NameNode;
  kind: "TYPE" | "INTERFACE" | "UNION" | "SCALAR" | "INPUT_OBJECT" | "ENUM";
};

type TsIdentifier = number;

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
  __nameToSymbol: Map<TsIdentifier, ts.Symbol> = new Map();
  _unresolvedNodes: Map<TsIdentifier, ts.TypeReferenceNode | ts.EntityName> =
    new Map();

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

  private nameToSymbol(name: NameNode): ts.Symbol | undefined {
    return this.__nameToSymbol.get(name.tsIdentifier);
  }

  // Record that a GraphQL construct of type `kind` with the name `name` is
  // declared at `node`.
  private _recordTypeName(
    node: ts.Node,
    name: NameNode,
    kind: NameDefinition["kind"],
  ) {
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
    this.__nameToSymbol.set(name.tsIdentifier, symbol);
    this._symbolToName.set(symbol, { name, kind });
  }

  // Record that a type references `node`
  private _markUnresolvedType(node: ts.EntityName, name: NameNode) {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      //
      throw new Error(
        "Could not resolve type reference. You probably have a TypeScript error.",
      );
    }

    const parent = node.parent;
    if (ts.isTypeReferenceNode(parent)) {
      // Hack: We need to be able to look up the parameterized
      // type later. So we record the unresolved node only if it's something that
      // can have type params. We should find a better way to do this.
      this._unresolvedNodes.set(name.tsIdentifier, parent);
    }

    this.__nameToSymbol.set(name.tsIdentifier, this.resolveSymbol(symbol));
    // this._unresolvedTypes.set(name.tsIdentifier, this.resolveSymbol(symbol));
  }

  findSymbolDeclaration(startSymbol: ts.Symbol): ts.Declaration | null {
    const symbol = this.resolveSymbol(startSymbol);
    const declaration = symbol.declarations?.[0];
    return declaration ?? null;
  }

  // Follow symbol aliases until we find the original symbol. Accounts for
  // cyclical aliases.
  private resolveSymbol(startSymbol: ts.Symbol): ts.Symbol {
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
    if (unresolved.value !== UNRESOLVED_REFERENCE_NAME) {
      return ok(unresolved);
    }
    const symbol = this.nameToSymbol(unresolved);
    if (symbol == null) {
      // This is a logic error on our side.
      throw new Error("Unexpected unresolved reference name.");
    }
    const nameDefinition = this._symbolToName.get(symbol);
    if (nameDefinition == null) {
      const declaration = this.findSymbolDeclaration(symbol);
      if (declaration != null && ts.isTypeParameterDeclaration(declaration)) {
        return err(
          gqlErr(
            loc(unresolved),
            "Type parameters are not supported in this context.",
          ),
        );
      }
      return err(gqlErr(loc(unresolved), E.unresolvedTypeReference()));
    }
    return ok({ ...unresolved, value: nameDefinition.name.value });
  }

  unresolvedNameIsGraphQL(unresolved: NameNode): boolean {
    const symbol = this.nameToSymbol(unresolved);
    return symbol != null && this._symbolToName.has(symbol);
  }

  // TODO: Merge this with resolveNamedType
  getNameDefinition(nameNode: NameNode): DiagnosticsResult<NameDefinition> {
    const typeNameResult = this.resolveNamedType(nameNode);
    if (typeNameResult.kind === "ERROR") {
      return err([typeNameResult.err]);
    }
    const symbol = this.nameToSymbol(nameNode);
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

  // TODO: Refactor?
  // Note! This assumes you have already handled any type parameters.
  resolveTsReferenceToGraphQLName(
    node: ts.EntityName,
  ): DiagnosticResult<string> {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol == null) {
      throw new Error(`Could not find symbol for ${node.getText()}`);
    }

    const nameDefinition = this._symbolToName.get(this.resolveSymbol(symbol));
    if (nameDefinition == null) {
      const declaration = this.findSymbolDeclaration(symbol);
      if (declaration != null && ts.isTypeParameterDeclaration(declaration)) {
        return err(
          tsErr(node, "Type parameter not valid", [
            tsErr(declaration, "Defined here"),
          ]),
        );
      }
      return err(tsErr(node, E.unresolvedTypeReference()));
    }
    return ok(nameDefinition.name.value);
  }

  resolveTsReferenceToDeclaration(
    node: ts.Node,
  ): DiagnosticResult<ts.Declaration> {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (!symbol) {
      throw new Error(`Could not find symbol for ${node.getText()}`);
    }
    const declaration = this.findSymbolDeclaration(symbol);
    if (!declaration) {
      return err(tsErr(node, E.unresolvedTypeReference()));
    }
    return ok(declaration);
  }

  getNameDeclaration(name: NameNode): ts.Declaration {
    const tsDefinition = this.nameToSymbol(name);
    if (!tsDefinition) {
      throw new Error(`Could not find type definition for ${name.value}`);
    }
    const declaration = this.findSymbolDeclaration(tsDefinition);
    if (!declaration) {
      throw new Error(`Could not find declaration for ${name.value}`);
    }
    return declaration;
  }

  getReferenceNode(
    name: NameNode,
  ): ts.EntityName | ts.TypeReferenceNode | null {
    if (name.value !== "__UNRESOLVED_REFERENCE__") {
      return null;
    }
    const tsNode = this._unresolvedNodes.get(name.tsIdentifier);
    if (!tsNode) {
      // TODO: This means the name did not point to a type reference.
      // Since we only care about potential generics here, we can ignore this.
      // NOTE: There are possibly other nodes that can have type params which
      // should be accounted for. See heritage clauses and type arguments.
      return null;
      throw new Error(`Could not find type node for ${name.value}`);
    }
    return tsNode;
  }
}
