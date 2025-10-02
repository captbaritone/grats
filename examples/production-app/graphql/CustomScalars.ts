import { Kind } from "graphql";
import type { SchemaConfig } from "../schema";

// TODO: Consider switching serialization to follow https://ibm.github.io/graphql-specs/custom-scalars/date.html

/**
 * A date and time. Serialized as a Unix timestamp.
 *
 * **Note**: The `@specifiedBy` directive does not point to a real spec, but is
 * included here for demonstration purposes.
 *
 * @gqlScalar Date
 * @gqlAnnotate specifiedBy(url: "https://example.com/html/spec-for-date-as-unix-timestamp")
 */
export type GqlDate = Date;

export const scalarConfig: SchemaConfig["scalars"] = {
  Date: {
    serialize(value) {
      if (value instanceof Date) {
        return value.getTime(); // Convert outgoing Date to integer for JSON
      }
      throw Error("GraphQL Date Scalar serializer expected a `Date` object");
    },
    parseValue(value) {
      if (typeof value === "number") {
        return new Date(value); // Convert incoming integer to Date
      }
      throw new Error("GraphQL Date Scalar parser expected a `number`");
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        // Convert hard-coded AST string to integer and then to Date
        return new Date(parseInt(ast.value, 10));
      }
      // Invalid hard-coded value (not an integer)
      throw new Error("GraphQL Date Scalar parser expected an `Int`");
    },
  },
};
