import { Location } from "graphql";
import * as ts from "typescript";
import { loc } from "./GraphQLConstructor.js";
import {
  MergedDeclaration,
  NameResolver,
  ResolvedDeclaration,
} from "./NameResolver.js";
import { DeclRef, declLoc } from "./snapshotRefs.js";

/**
 * A `NameResolver` backed by the TypeScript type checker. Only the checker's
 * symbol APIs are used, never type information.
 */
export class CheckerNameResolver implements NameResolver {
  private checker: ts.TypeChecker;

  constructor(private program: ts.Program) {
    this.checker = program.getTypeChecker();
  }

  resolveEntityName(name: Location): ResolvedDeclaration[] {
    const startSymbol = this.checker.getSymbolAtLocation(this.nodeAt(name));
    if (startSymbol == null) {
      return [];
    }
    const symbol = this.resolveSymbol(startSymbol);
    return (symbol.declarations ?? []).map((declaration) => ({
      kind: ts.isTypeParameterDeclaration(declaration)
        ? "TYPE_PARAMETER"
        : "DECLARATION",
      declLoc: declLoc(declaration),
      // Computed lazily since it's only needed for diagnostics.
      get loc() {
        return loc(declaration);
      },
    }));
  }

  mergedDeclarations(declaration: DeclRef): MergedDeclaration[] {
    const symbol = this.checker.getSymbolAtLocation(
      this.nodeAt(declaration.name),
    );
    if (symbol == null) {
      return [];
    }
    // @ts-ignore Exposed as public in https://github.com/microsoft/TypeScript/pull/56193
    const mergedSymbol: ts.Symbol = this.checker.getMergedSymbol(symbol);
    return (mergedSymbol.declarations ?? []).map((d) => ({
      kind: ts.isInterfaceDeclaration(d)
        ? "INTERFACE"
        : ts.isClassDeclaration(d)
          ? "CLASS"
          : "OTHER",
      declLoc: declLoc(d),
      get name() {
        return loc(ts.getNameOfDeclaration(d) ?? d);
      },
    }));
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

  /**
   * Finds the innermost node which spans exactly `loc`, so that the checker
   * can be asked about it.
   */
  private nodeAt(loc: Location): ts.Node {
    const sourceFile = this.program.getSourceFile(loc.source.name);
    if (sourceFile == null) {
      throw new Error(`Could not find source file "${loc.source.name}".`);
    }
    let found: ts.Node | null = null;
    let node: ts.Node | undefined = sourceFile;
    while (node != null) {
      if (node.end === loc.end && node.getStart(sourceFile) === loc.start) {
        found = node;
      }
      node = ts.forEachChild(node, (child) =>
        child.pos <= loc.start && loc.end <= child.end ? child : undefined,
      );
    }
    if (found == null) {
      throw new Error(
        `Could not find node at ${loc.source.name}:${loc.start}-${loc.end}.`,
      );
    }
    return found;
  }
}
