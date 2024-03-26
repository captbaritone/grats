import * as ts from "typescript";
import * as E from "../Errors";
import {
  DiagnosticsWithoutLocationResult,
  tsErr,
  tsRelated,
} from "../utils/DiagnosticError";
import { err, ok } from "../utils/Result";
import { TypeContext } from "../TypeContext";
import { ExtractionSnapshot } from "../Extractor";
import { prefixNode } from "../CodeActions";

/**
 * Ensure that all context type references resolve to the same
 * type declaration.
 */
export function validateContextReferences(
  ctx: TypeContext,
  snapshot: ExtractionSnapshot,
): DiagnosticsWithoutLocationResult<void> {
  const { contextReferences: references, contextDefinitions: definitions } =
    snapshot;

  if (definitions.length > 1) {
    return err([
      tsErr(definitions[1], E.multipleContextDefinitions(), [
        tsRelated(
          definitions[0],
          "A different context definition was found here",
        ),
      ]),
    ]);
  }

  const tagged: ts.Node | undefined = definitions[0];

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

    if (tagged == null) {
      return err([
        tsErr(
          typeName,
          "Add a @gqlContext tag",
          [tsRelated(declaration, "This is the type declaration")],
          {
            fixName: "add-context-tag",
            description: "Tag context declaration with @gqlContext",
            changes: [prefixNode(declaration, "/** @gqlContext */\n")],
          },
        ),
      ]);
    }

    if (tagged !== declaration) {
      return err([
        // TODO: Reword
        tsErr(typeName, E.multipleContextTypes(), [
          tsRelated(declaration, "A different type reference was used here"),
        ]),
      ]);
    }
  }
  return ok(undefined);
}
