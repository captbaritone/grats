/** @gqlType */
class Query {
  // No fields
}

/** @gqlField hello */
export function greeting(_: Query): string {
  return "Hello world!";
}
