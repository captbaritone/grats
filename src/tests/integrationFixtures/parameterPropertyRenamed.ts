/** @gqlType */
type Query = unknown;

/** @gqlField hello */
export function NOT_THIS(_: Query): string {
  return "world";
}

export const query = `
  query {
    hello
  }
`;
