/** @gqlType */
class Query {
  // No fields
}

/**
 * Best field ever!
 * @gqlField
 */
export function greeting(_: Query): string {
  return "Hello world!";
}
