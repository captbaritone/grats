/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query): string {
  return "Hello, world!";
}

export const operation = `
query {
  greeting
}`;
