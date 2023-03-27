/** @GQLType */
class Query {
  // No fields
}

/** @GQLField */
export function greeting(query: { name: string }): string {
  return "Hello world!";
}
