import * as ts from "typescript";
import * as E from "../Errors";
import {
  DiagnosticsWithoutLocationResult,
  tsErr,
  tsRelated,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import { TypeContext } from "../TypeContext";

/**
 * Ensure that all context type references resolve to the same
 * type declaration.
 */
export function validateContextReferences(
  ctx: TypeContext,
  references: ts.Node[],
): DiagnosticsWithoutLocationResult<void> {
  let gqlContext: { declaration: ts.Node; firstReference: ts.Node } | null =
    null;
  for (const typeName of references) {
    const symbol = ctx.checker.getSymbolAtLocation(typeName);
    if (symbol == null) {
      return err([
        tsErr(typeName, E.expectedTypeAnnotationOnContextToBeResolvable()),
      ]);
    }

    const declaration = ctx.findSymbolDeclaration(symbol);
    if (declaration == null) {
      return err([
        tsErr(typeName, E.expectedTypeAnnotationOnContextToHaveDeclaration()),
      ]);
    }

    if (gqlContext == null) {
      // This is the first typed context value we've seen...
      gqlContext = {
        declaration: declaration,
        firstReference: typeName,
      };
    } else if (gqlContext.declaration !== declaration) {
      return err([
        tsErr(typeName, E.multipleContextTypes(), [
          tsRelated(
            gqlContext.firstReference,
            "A different type reference was used here",
          ),
        ]),
      ]);
    }
  }
  return ok(undefined);
}
