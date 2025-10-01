-----------------
INPUT
----------------- 
import type { SchemaConfig } from "./schema";

/** @gqlScalar */
export type CustomScalar = number;

/** @gqlQueryField */
export function hello(custom: CustomScalar): CustomScalar {
  if (typeof custom !== "number") {
    throw new Error(
      `Expected custom to be a number, but it was ${typeof custom}`,
    );
  }
  return Number(custom);
}

export const schemaConfig: SchemaConfig = {
  scalars: {
    CustomScalar: {
      serialize(outputValue) {
        if (typeof outputValue !== "number") {
          throw new Error(
            `Expected outputValue to be a number, but it was ${typeof outputValue}`,
          );
        }
        // value comes from the server, so it's already in the internal format
        return outputValue.toString();
      },
      parseValue(value) {
        // value comes from the client, so we need to convert it to the internal format
        return Number(value);
      },
      parseLiteral(ast) {
        if (ast.kind === "StringValue") {
          return Number(ast.value);
        }
        throw new Error(
          "Query error: Can only parse strings to numbers but got a: " +
            ast.kind,
        );
      },
    },
  },
};

export const query = /* GraphQL */ `
  query ($someVar: CustomScalar!, $someOtherVar: CustomScalar!) {
    hello(custom: $someVar)
    helloAsWell: hello(custom: $someOtherVar)
    alsoHello: hello(custom: "5")
  }
`;

export const variables = {
  someVar: 123,
  someOtherVar: "456",
};

-----------------
OUTPUT
-----------------
{
  "data": {
    "hello": "123",
    "helloAsWell": "456",
    "alsoHello": "5"
  }
}