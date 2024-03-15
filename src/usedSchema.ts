import {
  DocumentNode,
  GraphQLSchema,
  visitWithTypeInfo,
  TypeInfo,
  visit,
  GraphQLNamedType,
  Kind,
  getNamedType,
} from "graphql";

export function extractUsedSchema(
  schema: GraphQLSchema,
  operation: DocumentNode,
): GraphQLSchema {
  const types: GraphQLNamedType[] = [];
  const typeInfo = new TypeInfo(schema);

  const visitor = {
    [Kind.OPERATION_DEFINITION](t) {
      const type = typeInfo.getType();
      if (type != null) {
        types.push(getNamedType(type));
      }
    },
  };

  visit(operation, visitWithTypeInfo(typeInfo, visitor));
  return new GraphQLSchema({
    types,
  });
}
