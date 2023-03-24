/** @GQLType */
class Query {
  // No fields
}

/** @GQLExtendType */
export default function greeting(_: Query): string {
  return `Hello World`;
}
