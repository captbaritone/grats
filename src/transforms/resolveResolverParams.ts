import { DefinitionNode, Kind, visit } from "graphql";
import { NameDefinition, TypeContext } from "../TypeContext";
import { err, ok } from "../utils/Result";
import {
  DiagnosticsResult,
  FixableDiagnosticWithLocation,
  gqlErr,
  gqlRelated,
} from "../utils/DiagnosticError";
import { loc } from "../utils/helpers";
import * as E from "../Errors";

export function resolveResolverParams(
  ctx: TypeContext,
  definitions: Array<DefinitionNode>,
): DiagnosticsResult<DefinitionNode[]> {
  const errors: FixableDiagnosticWithLocation[] = [];

  let infoDefinition: null | NameDefinition = null;
  let ctxDefinition: null | NameDefinition = null;
  // Check for duplicate @gqlInfo or @gqlContext annotations
  for (const namedDefinition of ctx.allNameDefinitions()) {
    switch (namedDefinition.kind) {
      case "CONTEXT":
        if (ctxDefinition != null) {
          errors.push(
            gqlErr(loc(namedDefinition.name), E.duplicateContextTag(), [
              gqlRelated(
                loc(ctxDefinition.name),
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
          errors.push(
            gqlErr(loc(namedDefinition.name), E.userDefinedInfoTag()),
          );
          continue;
        }
        infoDefinition = namedDefinition;
        break;
    }
  }

  const nextDefinitions = definitions.map((def) => {
    return visit(def, {
      [Kind.FIELD_DEFINITION]: (field) => {
        if (field.resolverParams != null) {
          const nextResolverParams = field.resolverParams.map((param) => {
            switch (param.kind) {
              case "named":
                return param;
              case "unresolved": {
                const resolved = ctx.gqlNameDefinitionForGqlName(
                  param.namedTypeNode.name,
                );
                if (resolved.kind === "ERROR") {
                  errors.push(resolved.err);
                  return param;
                }
                switch (resolved.value.kind) {
                  case "CONTEXT":
                    return { kind: "named", name: "context" };
                  case "INFO":
                    return { kind: "named", name: "info" };
                  default: {
                    errors.push(
                      gqlErr(
                        loc(param.namedTypeNode),
                        E.invalidResolverParamType(),
                      ),
                    );
                    return param;
                  }
                }
              }
              default: {
                const _exhaustive: never = param;
                throw new Error("Unexpected param kind");
              }
            }
          });
          return { ...field, resolverParams: nextResolverParams };
        }
        return field;
      },
    });
  });
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(nextDefinitions);
}
