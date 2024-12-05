import { GraphQLFieldResolver, GraphQLResolveInfo } from "graphql";

function resolver(source, args, context, info: GraphQLResolveInfo) {
  const field = info.parentType.getFields()[info.fieldName];
  const ast = field.astNode;
  if (ast == null) {
    throw new Error("AST not found");
  }
  const resolver = ast.directives?.find((d) => d.name.value === "resolver");
  if (resolver == null) {
    throw new Error("Resolver directive not found");
  }
  const kindArg = resolver.arguments?.find((a) => a.name.value === "kind");
  if (kindArg == null) {
    throw new Error("Kind argument not found");
  }
  console.log({ kindArg });
}

export const dynamicResolver: GraphQLFieldResolver<any, any> = resolver;
