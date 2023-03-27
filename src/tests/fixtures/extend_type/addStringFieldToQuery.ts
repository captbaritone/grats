/** @GQLType */
class Query {
  // No fields
}

/** @GQLField */
export function greeting(_: Query): string {
  return "Hello world!";
}
