/** @gqlType */
class Query {
  // No fields
}

/** @gqlField */
export function greeting(_: Query, args: { name: string }): string {
  return `Hello ${args.name}!`;
}
