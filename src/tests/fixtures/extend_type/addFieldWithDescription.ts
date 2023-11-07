/** @gqlType */
class SomeType {
  // No fields
}

/**
 * Best field ever!
 * @gqlField
 */
export function greeting(_: SomeType): string {
  return "Hello world!";
}
