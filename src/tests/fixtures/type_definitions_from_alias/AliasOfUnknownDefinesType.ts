/** @gqlType */
export type Query = unknown;

/** @gqlField */
export function greeting(_: Query): string {
  return "Hello world";
}
