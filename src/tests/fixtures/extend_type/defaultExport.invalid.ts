/** @GQLType */
class Query {
  // No fields
}

/** @GQLField */
export default function greeting(_: Query): string {
  return `Hello World`;
}
