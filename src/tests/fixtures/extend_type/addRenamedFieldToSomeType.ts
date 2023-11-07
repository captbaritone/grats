/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField hello */
export function greeting(_: SomeType): string {
  return "Hello world!";
}
