import {
  DefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  visit,
} from "graphql";
import { TypeContext, UNRESOLVED_REFERENCE_NAME } from "../TypeContext";
import { err, ok } from "../utils/Result";
import {
  DiagnosticsResult,
  FixableDiagnosticWithLocation,
  gqlRelated,
  tsErr,
} from "../utils/DiagnosticError";
import { nullThrows } from "../utils/helpers";
import {
  NamedFieldParam,
  PositionalFieldParam,
  Unresolved,
  UnresolvedResolverParam,
} from "../metadataDirectives.js";
import * as E from "../Errors";
import { GraphQLConstructor } from "../GraphQLConstructor";

export function resolveResolverParams(
  ctx: TypeContext,
  definitions: Array<DefinitionNode>,
): DiagnosticsResult<DefinitionNode[]> {
  const resolver = new ResolverParamsResolver(ctx);
  return resolver.resolve(definitions);
}

class ResolverParamsResolver {
  ctx: TypeContext;
  gql: GraphQLConstructor;
  errors: FixableDiagnosticWithLocation[] = [];
  constructor(ctx: TypeContext) {
    this.ctx = ctx;
    this.gql = new GraphQLConstructor();
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
    // Resolve all the params individually
    const resolverParams: UnresolvedResolverParam[] = field.resolverParams.map(
      (param) => this.transformParam(param),
    );

    // Now we check to see if the params are a valid combination...
    const args = resolverParams.find(
      (param): param is NamedFieldParam =>
        param.kind === "named" && param.name === "args",
    );
    const positionalArgs: PositionalFieldParam[] = resolverParams.filter(
      (param) => param.kind === "positionalArg",
    );

    if (args != null && positionalArgs.length > 0) {
      this.errors.push(
        tsErr(nullThrows(args.sourceNode), E.positionalArgAndArgsObject(), [
          gqlRelated(
            positionalArgs[0].inputDefinition,
            "Positional GraphQL argument defined here",
          ),
        ]),
      );
      return field;
    }

    const fieldArgs: InputValueDefinitionNode[] =
      field.arguments == null ? [] : [...field.arguments];

    // Add any positional args to the field's arguments
    for (const positionalArg of positionalArgs) {
      fieldArgs.push(positionalArg.inputDefinition);
    }

    return { ...field, arguments: fieldArgs, resolverParams };
  }

  transformParam(param: UnresolvedResolverParam): UnresolvedResolverParam {
    switch (param.kind) {
      case "topLevelParentType":
      case "named":
      case "positionalArg":
        return param;
      case "unresolved": {
        const unwrappedType = this.gql.nullableType(param.inputDefinition.type);
        if (
          unwrappedType.kind === "NamedType" &&
          unwrappedType.name.value === UNRESOLVED_REFERENCE_NAME
        ) {
          const resolved = this.ctx.gqlNameDefinitionForGqlName(
            unwrappedType.name,
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
              // We'll assume it's supposed to be a positional arg.
              return this.resolveToPositionalArg(param) ?? param;
            }
          }
        }
        // This can't be a context or info param so we'll assume it's supposed
        // to be a positional arg.
        return this.resolveToPositionalArg(param) ?? param;
      }
      default: {
        const _exhaustive: never = param;
        throw new Error("Unexpected param kind");
      }
    }
  }
  resolveToPositionalArg(unresolved: Unresolved): PositionalFieldParam | null {
    if (unresolved.inputDefinition.name.kind === "ERROR") {
      this.errors.push(unresolved.inputDefinition.name.err);
      return null;
    }
    return {
      kind: "positionalArg",
      inputDefinition: {
        ...unresolved.inputDefinition,
        name: unresolved.inputDefinition.name.value,
      },
    };
  }
}
