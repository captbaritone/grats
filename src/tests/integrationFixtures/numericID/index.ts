import { ID } from "../../../Types";

/**
 * Validating that graphql-js will coerce a numeric ID to a string.
 * https://github.com/captbaritone/grats/issues/53
 */

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function hello(_: Query, args: { someID: ID }): string {
  if (typeof args.someID !== "string") {
    throw new Error(
      `Expected someID to be a string, but it was ${typeof args.someID}`,
    );
  }
  return args.someID;
}

export const query = /* GraphQL */ `
  query SomeQuery($someID: ID!) {
    hello(someID: $someID)
  }
`;

export const variables = {
  someID: 123,
};
