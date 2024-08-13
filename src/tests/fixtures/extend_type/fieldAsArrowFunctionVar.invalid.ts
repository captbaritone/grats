/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
var greeting = (_: SomeType): string => {
  return `Hello World`;
};
