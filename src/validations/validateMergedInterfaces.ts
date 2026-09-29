import * as ts from "typescript";
import * as E from "../Errors.js";
import {
  DiagnosticsWithoutLocationResult,
  gqlErr,
  tsRelated,
} from "../utils/DiagnosticError.js";
import { err, ok } from "../utils/Result.js";
import { DeclRef, declLoc } from "../snapshotRefs.js";
import { NodeLocator } from "../utils/NodeLocator.js";

/**
 * Prevent using merged interfaces as GraphQL interfaces.
 * https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces
 */
export function validateMergedInterfaces(
  checker: ts.TypeChecker,
  locator: NodeLocator,
  interfaces: DeclRef[],
): DiagnosticsWithoutLocationResult<void> {
  const errors: ts.DiagnosticWithLocation[] = [];

  for (const declaration of interfaces) {
    const symbol = checker.getSymbolAtLocation(
      locator.nodeAt(declaration.name),
    );
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
          declLoc(d) !== declaration.declLoc &&
          (ts.isInterfaceDeclaration(d) || ts.isClassDeclaration(d)),
      )
      .map((d) => {
        const locNode = ts.getNameOfDeclaration(d) ?? d;
        return tsRelated(locNode, "Other declaration");
      });

    if (otherLocations.length > 0) {
      errors.push(
        gqlErr({ loc: declaration.name }, E.mergedInterfaces(), otherLocations),
      );
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }
  return ok(undefined);
}
