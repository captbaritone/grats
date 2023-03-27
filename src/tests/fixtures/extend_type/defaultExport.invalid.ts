/** @gqlType */
class Query {
  // No fields
}

/** @gqlField */
export default function greeting(_: Query): string {
  return `Hello World`;
}
