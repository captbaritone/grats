import * as ts from "typescript";
import * as E from "../Errors.js";
import {
  DiagnosticsWithoutLocationResult,
  gqlErr,
  gqlRelated,
} from "../utils/DiagnosticError.js";
import { err, ok } from "../utils/Result.js";
import { DeclRef } from "../snapshotRefs.js";
import { NameResolver } from "../NameResolver.js";

/**
 * Prevent using merged interfaces as GraphQL interfaces.
 * https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces
 */
export function validateMergedInterfaces(
  resolver: NameResolver,
  interfaces: DeclRef[],
): DiagnosticsWithoutLocationResult<void> {
  const errors: ts.DiagnosticWithLocation[] = [];

  for (const declaration of interfaces) {
    const mergedDeclarations = resolver.mergedDeclarations(declaration);
    if (mergedDeclarations.length < 2) {
      continue;
    }

    const otherLocations = mergedDeclarations
      .filter(
        (d) =>
          d.declLoc !== declaration.declLoc &&
          (d.kind === "INTERFACE" || d.kind === "CLASS"),
      )
      .map((d) => {
        return gqlRelated({ loc: d.name }, "Other declaration");
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
