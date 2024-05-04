type GraphqlContext = {};

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function someType(_: Query): SomeType {
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
