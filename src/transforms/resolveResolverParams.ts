import { DefinitionNode, FieldDefinitionNode, Kind, visit } from "graphql";
import { TypeContext } from "../TypeContext";
import { err, ok } from "../utils/Result";
import {
  DiagnosticsResult,
  FixableDiagnosticWithLocation,
  gqlErr,
} from "../utils/DiagnosticError";
import { loc } from "../utils/helpers";
import * as E from "../Errors";
import { UnresolvedResolverParam } from "../metadataDirectives.js";

export function resolveResolverParams(
  ctx: TypeContext,
  definitions: Array<DefinitionNode>,
): DiagnosticsResult<DefinitionNode[]> {
  const resolver = new ResolverParamsResolver(ctx);
  return resolver.resolve(definitions);
}

class ResolverParamsResolver {
  ctx: TypeContext;
  errors: FixableDiagnosticWithLocation[] = [];
  constructor(ctx: TypeContext) {
    this.ctx = ctx;
  }

  resolve(
    definitions: Array<DefinitionNode>,
  ): DiagnosticsResult<DefinitionNode[]> {
    const nextDefinitions = definitions.map((def) => {
      return visit(def, {
        [Kind.FIELD_DEFINITION]: (field) => this.transformField(field),
      });
    });

    if (this.errors.length > 0) {
      return err(this.errors);
    }
    return ok(nextDefinitions);
  }

  private transformField(field: FieldDefinitionNode): FieldDefinitionNode {
    if (field.resolverParams == null) {
      return field;
    }
    const nextResolverParams: UnresolvedResolverParam[] =
      field.resolverParams.map((param) => {
        return this.transformParam(param);
      });
    return { ...field, resolverParams: nextResolverParams };
  }

  transformParam(param: UnresolvedResolverParam): UnresolvedResolverParam {
    switch (param.kind) {
      case "named":
        return param;
      case "unresolved": {
        const resolved = this.ctx.gqlNameDefinitionForGqlName(
          param.namedTypeNode.name,
        );
        if (resolved.kind === "ERROR") {
          this.errors.push(resolved.err);
          return param;
        }
        switch (resolved.value.kind) {
          case "CONTEXT":
            return { kind: "named", name: "context" };
          case "INFO":
            return { kind: "named", name: "info" };
          default: {
            this.errors.push(
              gqlErr(loc(param.namedTypeNode), E.invalidResolverParamType()),
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
  }
}
