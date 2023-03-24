/** @GQLType */
class Query {
  // No fields
}

/** @GQLExtendType */
export function greeting(_: Query): string {
  return "Hello world!";
}
