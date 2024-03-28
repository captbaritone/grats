/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export default function greeting(_: SomeType): string {
  return `Hello World`;
}
