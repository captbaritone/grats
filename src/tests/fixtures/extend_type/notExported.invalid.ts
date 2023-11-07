/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
function greeting(_: Query): string {
  return `Hello World`;
}
