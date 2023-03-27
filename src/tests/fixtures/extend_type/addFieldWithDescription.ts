/** @GQLType */
class Query {
  // No fields
}

/**
 * Best field ever!
 * @GQLField
 */
export function greeting(_: Query): string {
  return "Hello world!";
}
