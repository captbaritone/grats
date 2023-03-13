import { DocumentNode, NamedTypeNode, visit } from "graphql";
import * as ts from "typescript";
import DiagnosticError, { AnnotatedLocation } from "./utils/DiagnosticError";
import * as Location from "./utils/Location";

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

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

  _symbolToName: Map<ts.Symbol, string> = new Map();
  _unresolvedTypes: Map<NamedTypeNode, ts.Symbol> = new Map();

  constructor(checker: ts.TypeChecker) {
    this.checker = checker;
  }

  recordTypeName(node: ts.Node, name: string) {
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
    this._symbolToName.set(symbol, name);
  }

  markUnresolvedType(node: ts.Node, namedType: NamedTypeNode) {
    let symbol = this.checker.getSymbolAtLocation(node);
    // Follow any aliases to get the real type declaration.
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      symbol = this.checker.getAliasedSymbol(symbol);
    }
    // TODO: TS Says this can never be null, but I worry it can.
    if (symbol == null) {
      throw new Error(
        "Could not resolve type reference. You probably have a TypeScript error.",
      );
    }

    this._unresolvedTypes.set(namedType, symbol);
  }

  resolveTypes(doc: DocumentNode): DocumentNode {
    return visit(doc, {
      NamedType: (t) => this.resolveNamedType(t),
    });
  }

  resolveNamedType(namedType: NamedTypeNode): NamedTypeNode {
    const symbol = this._unresolvedTypes.get(namedType);
    if (symbol == null) {
      if (namedType.name.value === UNRESOLVED_REFERENCE_NAME) {
        // This is a logic error on our side.
        throw new Error("Unexpected unresolved reference name.");
      }
      return namedType;
    }
    const name = this._symbolToName.get(symbol);
    if (name == null) {
      if (namedType.loc == null) {
        throw new Error("Expected namedType to have a location.");
      }
      throw new DiagnosticError(
        "This type is not a valid GraphQL type. Did you mean to annotate it's definition with `/** @GQLType */` or `/** @GQLScalar */`?",
        new AnnotatedLocation(Location.fromGraphQLLocation(namedType.loc), ""),
      );
    }
    return { ...namedType, name: { ...namedType.name, value: name } };
  }
}
