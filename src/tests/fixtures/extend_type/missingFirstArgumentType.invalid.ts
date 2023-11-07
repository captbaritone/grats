/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(
  query /* Without an arg type we can't infer the GraphQL type to extend! */,
): string {
  return "Hello world!";
}
