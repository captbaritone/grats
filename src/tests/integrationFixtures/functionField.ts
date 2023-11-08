/** @gqlType */
type Query = unknown;

/** @gqlField */
export function hello(_: Query): string {
  return "Hello World";
}

export const query = `
    query {
      hello
    }
  `;
