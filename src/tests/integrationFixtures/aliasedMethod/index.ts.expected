-----------------
INPUT
----------------- 
/** @gqlContext */
type GraphqlContext = {};

/** @gqlQueryField */
export function someType(): SomeType {
  return new SomeType();
}

/** @gqlType */
class SomeType {
  /** @gqlField someName */
  async someOtherName(
    args: { greeting: string },
    ctx: GraphqlContext,
  ): Promise<string> {
    return `${args.greeting} World!`;
  }
}

export const query = /* GraphQL */ `
  query {
    someType {
      someName(greeting: "Hello")
    }
  }
`;

-----------------
OUTPUT
-----------------
{
  "data": {
    "someType": {
      "someName": "Hello World!"
    }
  }
}