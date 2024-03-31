/** @gqlType */
type Query = unknown;

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlField */
export function me(_: Query): User {
  return { name: "Alice" };
}

/** @gqlField */
export function greeting(_: Query): string {
  return "Hello, world!";
}

export const OPERATION = /* GraphQL */ `
  query {
    greeting
    me {
      name
    }
  }
`;
