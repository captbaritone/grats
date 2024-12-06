import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLField,
  GraphQLFieldResolver,
} from "graphql";

export async function setResolvers(schema: GraphQLSchema, resolvers: any) {
  const typeMap = schema.getTypeMap();

  for (const type of Object.values(typeMap)) {
    // Ignore internal types like __Schema, __Type, etc.
    if (!type.name.startsWith("__") && type instanceof GraphQLObjectType) {
      const fields = type.getFields();
      for (const field of Object.values(fields)) {
        // Set a custom resolver on each field
        field.resolve = await makeResolver(
          field,
          resolvers.types[type.name][field.name],
        );
      }
    }
  }
}

async function importPath(p: string) {
  return await import(
    // Little hack here while we sort out how to structure paths.
    p.replace("examples/production-app/", "./").replace(".ts", ".js")
  );
}

function getArgs(argsDefs: any[], args: [any, any, any, any]) {
  return argsDefs.map((arg: any) => {
    switch (arg.kind) {
      case "source":
        return args[0];
      case "argumentsObject":
        return args[1];
      case "context":
        return args[2];
      case "information":
        return args[3];
      case "named":
        return args[1][arg.name];
      default:
        throw new Error("Unknown arg kind");
    }
  });
}

async function makeResolver<S = any>(
  field: GraphQLField<any, any>,
  signature: any,
): Promise<GraphQLFieldResolver<S, any, any, unknown>> {
  switch (signature.kind) {
    case "function": {
      const module = await importPath(signature.path);
      const resolver = module[signature.exportName];
      const argsDefs = signature.arguments;
      return (...args) => {
        return resolver(...getArgs(argsDefs, args));
      };
    }
    case "staticMethod": {
      const module = await importPath(signature.path);
      const resolver = module[signature.exportName][signature.name];
      const argsDefs = signature.arguments;
      return (...args) => {
        return resolver(...getArgs(argsDefs, args));
      };
    }
    case "method": {
      const methodName = signature.name ?? field.name;
      const argsDefs = signature.arguments;
      return (...args) => {
        // @ts-ignore
        return args[0][methodName](...getArgs(argsDefs, args));
      };
    }
    case "property": {
      const name = signature.name ?? field.name;
      return (source: any) => {
        return source[name];
      };
    }
    default:
      throw new Error("Unknown kind");
  }
}
