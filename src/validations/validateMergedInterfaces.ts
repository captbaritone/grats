import * as ts from "typescript";
import * as E from "../Errors";
import {
  DiagnosticsWithoutLocationResult,
  tsErr,
  tsRelated,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";

/**
 * Prevent using merged interfaces as GraphQL interfaces.
 * https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces
 */
export function validateMergedInterfaces(
  checker: ts.TypeChecker,
  interfaces: ts.InterfaceDeclaration[],
): DiagnosticsWithoutLocationResult<void> {
  const errors: ts.DiagnosticWithLocation[] = [];

  for (const node of interfaces) {
    const symbol = checker.getSymbolAtLocation(node.name);
    if (symbol == null) {
      continue;
    }
    // @ts-ignore Exposed as public in https://github.com/microsoft/TypeScript/pull/56193
    const mergedSymbol: ts.Symbol = checker.getMergedSymbol(symbol);
    if (
      mergedSymbol.declarations == null ||
      mergedSymbol.declarations.length < 2
    ) {
      continue;
    }

    const otherLocations = mergedSymbol.declarations
      .filter(
        (d) =>
          d !== node &&
          (ts.isInterfaceDeclaration(d) || ts.isClassDeclaration(d)),
      )
      .map((d) => {
        const locNode = ts.getNameOfDeclaration(d) ?? d;
        return tsRelated(locNode, "Other declaration");
      });

    if (otherLocations.length > 0) {
      errors.push(tsErr(node.name, E.mergedInterfaces(), otherLocations));
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }
  return ok(undefined);
}
