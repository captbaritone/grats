import { GraphQLScalarType, GraphQLSchema, Kind } from "graphql";

// Note: Grats does not yet have support for @specifiedBy directive.
// See https://github.com/captbaritone/grats/issues/127 tracking this gap.
//
// TODO: Consider switching serialization to follow https://ibm.github.io/graphql-specs/custom-scalars/date.html

/**
 * A date and time. Serialized as a Unix timestamp.
 *
 * **Note**: The `@specifiedBy` directive does not point to a real spec, but is
 * included here for demonstration purposes.
 *
 * @gqlScalar Date
 * @specifiedBy https://example.com/html/spec-for-date-as-unix-timestamp
 */
export type GqlDate = Date;

// Grats does not yet have a built-in mechanism for defining the serialization and deserialization of
// custom scalar types.
//
// See https://github.com/captbaritone/grats/issues/66 tracking this gap.
export function addGraphQLScalarSerialization(schema: GraphQLSchema) {
  const dateType = schema.getType("Date");
  if (!(dateType instanceof GraphQLScalarType)) {
    throw new Error(`Expected "Date" to be a scalar type`);
  }

  dateType.serialize = (value) => {
    if (value instanceof Date) {
      return value.getTime(); // Convert outgoing Date to integer for JSON
    }
    throw Error("GraphQL Date Scalar serializer expected a `Date` object");
  };
  dateType.parseValue = (value) => {
    if (typeof value === "number") {
      return new Date(value); // Convert incoming integer to Date
    }
    throw new Error("GraphQL Date Scalar parser expected a `number`");
  };
  dateType.parseLiteral = (ast) => {
    if (ast.kind === Kind.INT) {
      // Convert hard-coded AST string to integer and then to Date
      return new Date(parseInt(ast.value, 10));
    }
    // Invalid hard-coded value (not an integer)
    return null;
  };
}
