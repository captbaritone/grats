/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
const greeting = (_: SomeType): string => {
  return `Hello World`;
};
