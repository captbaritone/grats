/** @GQLType */
class Query {
  // No fields
}

/** @GQLExtendType */
export function greeting(query: { name: string }): string {
  return "Hello world!";
}
