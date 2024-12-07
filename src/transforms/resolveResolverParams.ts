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
  tsErr,
  tsRelated,
} from "../utils/DiagnosticError";
import { nullThrows } from "../utils/helpers";
import {
  NamedResolverArgument,
  ResolverArgument,
  UnresolvedResolverArgument,
} from "../resolverSignature";
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
    const resolver = nullThrows(field.resolver);

    if (resolver.kind === "property" || resolver.arguments == null) {
      return field;
    }

    // Resolve all the params individually
    const resolverParams: ResolverArgument[] = resolver.arguments.map((param) =>
      this.transformParam(param),
    );

    // Now we check to see if the params are a valid combination...
    const args = resolverParams.find(
      (param) => param.kind === "argumentsObject",
    );
    const positionalArgs: NamedResolverArgument[] = resolverParams.filter(
      (param) => param.kind === "named",
    );

    if (args != null && positionalArgs.length > 0) {
      this.errors.push(
        tsErr(nullThrows(args.node), E.positionalArgAndArgsObject(), [
          tsRelated(
            positionalArgs[0].node,
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

    const newResolver = {
      ...resolver,
      arguments: resolverParams,
    };

    return { ...field, arguments: fieldArgs, resolver: newResolver };
  }

  transformParam(param: ResolverArgument): ResolverArgument {
    switch (param.kind) {
      case "named":
      case "argumentsObject":
      case "information":
      case "context":
      case "source":
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
              return { kind: "context", node: param.node };
            case "INFO":
              return { kind: "information", node: param.node };
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
        // @ts-expect-error
        throw new Error(`Unexpected param kind ${param.kind}`);
      }
    }
  }
  resolveToPositionalArg(
    unresolved: UnresolvedResolverArgument,
  ): ResolverArgument | null {
    if (unresolved.inputDefinition.name.kind === "ERROR") {
      this.errors.push(unresolved.inputDefinition.name.err);
      return null;
    }
    return {
      kind: "named",
      name: unresolved.inputDefinition.name.value.value,
      inputDefinition: {
        ...unresolved.inputDefinition,
        name: unresolved.inputDefinition.name.value,
      },
      node: unresolved.node,
    };
  }
}
