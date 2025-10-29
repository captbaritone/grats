import { DocumentNode, Kind } from "graphql";
import {
  ResolverArgument,
  ResolverDefinition,
  Metadata,
  FieldDefinition,
  ContextArgs,
} from "../metadata";
import { invariant, nullThrows } from "../utils/helpers";
import { ResolverArgument as DirectiveResolverArgument } from "../resolverSignature";

export function makeResolverSignature(documentAst: DocumentNode): Metadata {
  const resolvers: Metadata = {
    types: {},
  };

  for (const declaration of documentAst.definitions) {
    if (declaration.kind !== Kind.OBJECT_TYPE_DEFINITION) {
      continue;
    }
    if (declaration.fields == null) {
      continue;
    }

    const fieldResolvers: Record<string, FieldDefinition> = {};

    for (const fieldAst of declaration.fields) {
      const fieldResolver = nullThrows(fieldAst?.resolver);
      const fieldName = fieldAst.name.value;
      let resolver: ResolverDefinition;
      switch (fieldResolver.kind) {
        case "property":
          resolver = {
            kind: "property",
            name: fieldResolver.name,
          };
          break;
        case "function":
          resolver = {
            kind: "function",
            exported: {
              tsModulePath: fieldResolver.path,
              exportName: fieldResolver.exportName,
            },
            arguments: transformArgs(fieldResolver.arguments),
          };
          break;
        case "method":
          resolver = {
            kind: "method",
            name: fieldResolver.name,
            arguments: transformArgs(fieldResolver.arguments),
          };
          break;
        case "staticMethod":
          resolver = {
            kind: "staticMethod",
            exported: {
              tsModulePath: fieldResolver.path,
              exportName: fieldResolver.exportName,
            },
            name: fieldResolver.name,
            arguments: transformArgs(fieldResolver.arguments),
          };
          break;
        default:
          // @ts-expect-error
          throw new Error(`Unknown resolver kind: ${fieldResolver.kind}`);
      }

      fieldResolvers[fieldName] = { resolver };
    }

    resolvers.types[declaration.name.value] = fieldResolvers;
  }

  return resolvers;
}

function transformArgs(
  args: DirectiveResolverArgument[] | null,
): ResolverArgument[] | null {
  if (args == null) {
    return null;
  }
  return args.map(transformArg);
}

function transformArg(arg: DirectiveResolverArgument): ResolverArgument {
  switch (arg.kind) {
    case "argumentsObject":
      return { kind: "argumentsObject" };
    case "named":
      return { kind: "named", name: arg.name };
    case "source":
      return { kind: "source" };
    case "information":
      return { kind: "information" };
    case "context":
      return { kind: "context" };
    case "derivedContext":
      return {
        kind: "derivedContext",
        exported: {
          tsModulePath: arg.path,
          exportName: arg.exportName,
        },
        args: arg.args.map((arg): ContextArgs => {
          const newArg = transformArg(arg);
          invariant(
            newArg.kind === "derivedContext" || newArg.kind === "context",
            "Previous validation passes ensure we only have valid derived context args here",
          );
          return newArg;
        }),
      };
    case "unresolved":
      throw new Error("Unresolved argument in resolver");
    default:
      // @ts-expect-error
      throw new Error(`Unknown argument kind: ${arg.kind}`);
  }
}
