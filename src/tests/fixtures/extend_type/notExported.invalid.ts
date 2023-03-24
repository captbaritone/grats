/** @GQLType */
class Query {
  // No fields
}

/** @GQLExtendType */
function greeting(_: Query): string {
  return `Hello World`;
}
