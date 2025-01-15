import { NameDefinition, TypeContext } from "../TypeContext";
import { err, ok } from "../utils/Result";
import {
  DiagnosticsResult,
  FixableDiagnosticWithLocation,
  gqlErr,
  gqlRelated,
} from "../utils/DiagnosticError";
import * as E from "../Errors";

export function validateDuplicateContextOrInfo(
  ctx: TypeContext,
): DiagnosticsResult<void> {
  const errors: FixableDiagnosticWithLocation[] = [];
  let infoDefinition: null | NameDefinition = null;
  let ctxDefinition: null | NameDefinition = null;
  for (const namedDefinition of ctx.allDefinitions()) {
    switch (namedDefinition.kind) {
      case "CONTEXT":
        if (ctxDefinition != null) {
          errors.push(
            gqlErr(namedDefinition.name, E.duplicateContextTag(), [
              gqlRelated(
                ctxDefinition.name,
                "`@gqlContext` previously defined here.",
              ),
            ]),
          );
          continue;
        }
        ctxDefinition = namedDefinition;
        break;
      case "INFO":
        if (infoDefinition != null) {
          errors.push(gqlErr(namedDefinition.name, E.userDefinedInfoTag()));
          continue;
        }
        infoDefinition = namedDefinition;
        break;
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(undefined);
}
