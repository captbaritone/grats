/** @GQLType */
class Query {
  // No fields
}

/** @GQLField */
function greeting(_: Query): string {
  return `Hello World`;
}
