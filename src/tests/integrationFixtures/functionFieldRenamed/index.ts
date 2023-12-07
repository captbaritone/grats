/** @gqlType */
type Query = unknown;

/** @gqlField hello */
export function notHello(_: Query): string {
  return "Hello World";
}

export const query = `
    query {
      hello
    }
  `;
