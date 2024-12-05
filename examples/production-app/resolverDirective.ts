import {
  GraphQLObjectType,
  GraphQLSchema,
  ConstValueNode,
  valueFromASTUntyped,
  GraphQLField,
  GraphQLFieldResolver,
} from "graphql";

export async function setResolvers(schema: GraphQLSchema) {
  const typeMap = schema.getTypeMap();

  for (const type of Object.values(typeMap)) {
    // Ignore internal types like __Schema, __Type, etc.
    if (!type.name.startsWith("__") && type instanceof GraphQLObjectType) {
      const fields = type.getFields();
      for (const field of Object.values(fields)) {
        // Set a custom resolver on each field
        field.resolve = await makeResolver(field);
      }
    }
  }
}

// Convert a constant value in a GraphQL AST into the equivalent JavaScript
// value.
function materialize(value: ConstValueNode): any {
  return valueFromASTUntyped(value);
}

async function importPath(p: string) {
  return await import(
    // Little hack here while we sort out how to structure paths.
    p.replace("examples/production-app/", "./").replace(".ts", ".js")
  );
}

function getArgs(argsDefs: any[], args: [any, any, any, any]) {
  return argsDefs.map((arg: any) => {
    if (arg.source != null) return args[0];
    else if (arg.argumentsObject != null) return args[1];
    else if (arg.context != null) return args[2];
    else if (arg.information != null) return args[3];
    else if (arg.named != null) return args[1][arg.named.name];
    throw new Error("Unknown arg kind");
  });
}

async function makeResolver<S = any>(
  field: GraphQLField<any, any>,
): Promise<GraphQLFieldResolver<S, any, any, unknown>> {
  const kindArg = field.astNode?.directives
    ?.find((d) => d.name.value === "resolver")
    ?.arguments?.find((a) => a.name.value === "kind")?.value;
  if (kindArg == null) {
    throw new Error("Resolver directive kind found");
  }

  const kind = materialize(kindArg);
  if (kind.function) {
    const module = await importPath(kind.function.path);
    const resolver = module[kind.function.exportName];
    const argsDefs = kind.function.arguments;
    return (...args) => {
      return resolver(...getArgs(argsDefs, args));
    };
  } else if (kind.staticMethod) {
    const module = await importPath(kind.staticMethod.path);
    const resolver =
      module[kind.staticMethod.exportName][kind.staticMethod.name];
    const argsDefs = kind.staticMethod.arguments;
    return (...args) => {
      return resolver(...getArgs(argsDefs, args));
    };
  } else if (kind.method) {
    const methodName = kind.method.name ?? field.name;
    const argsDefs = kind.method.arguments;
    return (...args) => {
      // @ts-ignore
      return args[0][methodName](...getArgs(argsDefs, args));
    };
  } else if (kind.property) {
    const name = kind.property.name ?? field.name;
    return (source: any) => {
      return source[name];
    };
  }
  throw new Error("Unknown kind");
}
