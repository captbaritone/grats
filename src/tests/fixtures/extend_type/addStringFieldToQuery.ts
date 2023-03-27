/** @gqlType */
class Query {
  // No fields
}

/** @gqlField */
export function greeting(_: Query): string {
  return "Hello world!";
}
