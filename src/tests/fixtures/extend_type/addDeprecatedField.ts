/** @GQLType */
class Query {
  // No fields
}

/**
 * @GQLExtendType
 * @deprecated Because reasons
 */
export function greeting(query: Query): string {
  return "Hello world!";
}
