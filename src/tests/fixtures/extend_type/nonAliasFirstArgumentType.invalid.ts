/** @gqlType */
class Query {
  // No fields
}

/** @gqlField */
export function greeting(query: { name: string }): string {
  return "Hello world!";
}
