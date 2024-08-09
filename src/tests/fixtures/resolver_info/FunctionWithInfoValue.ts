/** @gqlField */
export function greetz(_: Query, args: unknown, ctx: unknown, info): string {
  return "Hello";
}

/** @gqlType */
type Query = unknown;
