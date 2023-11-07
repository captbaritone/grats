/** @gqlType */
export type SomeType = unknown;

/** @gqlField */
export function greeting(_: SomeType): string {
  return "Hello world";
}
