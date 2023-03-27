/** @gqlType */
class Query {
  // No fields
}

/**
 * @gqlField
 * @deprecated Because reasons
 */
export function greeting(query: Query): string {
  return "Hello world!";
}
