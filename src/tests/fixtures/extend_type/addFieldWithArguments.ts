/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(_: SomeType, args: { name: string }): string {
  return `Hello ${args.name}!`;
}
