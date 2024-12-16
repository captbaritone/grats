/** @gqlType */
type Query = unknown;

/** @gqlQueryField */
export function greeting(_: Query): string {
  return "Hello world";
}
