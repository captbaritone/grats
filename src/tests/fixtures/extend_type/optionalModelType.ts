/** @gqlType */
class Query {
  // No fields
}

/** @gqlField */
export function greeting(
  // A bit odd that this is optional, but it's fine, since we will always call
  // it with a non-null value
  q?: Query,
): string {
  if (q == null) {
    return "Out!";
  }
  return "Hello world!";
}
