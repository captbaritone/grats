/** @GQLType */
class Query {
  // No fields
}

/** @GQLExtendType */
export function greeting(/* Without an arg we can't infer the type! */): string {
  return "Hello world!";
}
