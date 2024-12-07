/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = (_: SomeType, name: string): string => {
  return `Hello ${name}`;
};
