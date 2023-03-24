/** @GQLType */
class Query {
  // No fields
}

/**
 * Best field ever!
 * @GQLExtendType
 */
export function greeting(_: Query): string {
  return "Hello world!";
}
