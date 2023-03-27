/** @GQLType */
class Query {
  // No fields
}

/** @GQLField */
export function greeting(_: Query, args: { name: string }): string {
  return `Hello ${args.name}!`;
}
