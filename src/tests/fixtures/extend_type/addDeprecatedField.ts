/** @GQLType */
class Query {
  // No fields
}

/**
 * @GQLField
 * @deprecated Because reasons
 */
export function greeting(query: Query): string {
  return "Hello world!";
}
