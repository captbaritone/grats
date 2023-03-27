/** @GQLType */
class Query {
  // No fields
}

/** @GQLField */
export function greeting(
  query /* Without an arg type we can't infer the GraphQL type to extend! */,
): string {
  return "Hello world!";
}
