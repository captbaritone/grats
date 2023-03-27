/** @GQLType */
class Query {
  // No fields
}

/** @GQLField */
export function greeting(/* Without an arg we can't infer the type! */): string {
  return "Hello world!";
}
