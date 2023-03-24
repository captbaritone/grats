/** @GQLType */
class Query {
  // No fields
}

/** @GQLExtendType */
export function greeting(_: Query, args: { name: string }): string {
  return `Hello ${args.name}!`;
}
