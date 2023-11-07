/** @gqlType */
class SomeType {
  // No fields
}

/**
 * @gqlField
 * @deprecated Because reasons
 */
export function greeting(query: SomeType): string {
  return "Hello world!";
}
