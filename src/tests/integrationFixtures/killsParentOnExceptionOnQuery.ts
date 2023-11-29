/** @gqlType */
type Query = unknown;

/**
 * @gqlField
 * @killsParentOnException
 */
export function alwaysThrowsKillsParentOnException(_: Query): string {
  throw new Error("This error should kill Query");
}

/** @gqlField */
export function hello(_: Query): string {
  return "Hello Worl";
}

export const query = `
  query {
    alwaysThrowsKillsParentOnException
    hello
  }
`;
