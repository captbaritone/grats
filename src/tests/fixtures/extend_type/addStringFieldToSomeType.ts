/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(_: SomeType): string {
  return "Hello world!";
}
