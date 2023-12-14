/** @gqlType */
type Query = unknown;

/** @gqlField */
export function hello(
  _: Query,
  { greeting = "Hello" }: { greeting: string },
): string {
  return `${greeting}, world!`;
}

export const query = `
    query {
      hello
    }
  `;
