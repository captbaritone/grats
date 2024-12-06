import { DocumentNode, Kind } from "graphql";
import {
  ResolverArgument,
  ResolverDefinition,
  Resolvers,
} from "../resolverSchema";
import { nullThrows } from "../utils/helpers";
import { ResolverArgument as DirectiveResolverArgument } from "../resolverDirective";

export function makeResolverSignature(documentAst: DocumentNode): Resolvers {
  const resolvers: Resolvers = {
    types: {},
  };

  for (const declaration of documentAst.definitions) {
    if (declaration.kind !== Kind.OBJECT_TYPE_DEFINITION) {
      continue;
    }
    if (declaration.fields == null) {
      continue;
    }

    const fieldResolvers: Record<string, ResolverDefinition> = {};

    for (const fieldAst of declaration.fields) {
      const fieldResolver = nullThrows(fieldAst?.resolver);
      const fieldName = fieldAst.name.value;
      switch (fieldResolver.kind) {
        case "property":
          fieldResolvers[fieldName] = {
            kind: "property",
            name: fieldResolver.name,
          };
          break;
        case "function":
          fieldResolvers[fieldName] = {
            kind: "function",
            path: fieldResolver.path,
            exportName: fieldResolver.exportName,
            arguments: transformArgs(fieldResolver.arguments),
          };
          break;
        case "method":
          fieldResolvers[fieldName] = {
            kind: "method",
            name: fieldResolver.name,
            arguments: transformArgs(fieldResolver.arguments),
          };
          break;
        case "staticMethod":
          fieldResolvers[fieldName] = {
            kind: "staticMethod",
            path: fieldResolver.path,
            exportName: fieldResolver.exportName,
            name: fieldResolver.name,
            arguments: transformArgs(fieldResolver.arguments),
          };
          break;
        default:
          // @ts-expect-error
          throw new Error(`Unknown resolver kind: ${fieldResolver.kind}`);
      }
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
  return args.map((arg): ResolverArgument => {
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
      case "unresolved":
        throw new Error("Unresolved argument in resolver");
      default:
        // @ts-expect-error
        throw new Error(`Unknown argument kind: ${arg.kind}`);
    }
  });
}
