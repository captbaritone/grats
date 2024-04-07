/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query): string {
  return "Hello World!";
}

export const operation = /* GraphQL */ `
  query {
    greeting
  }
`;
