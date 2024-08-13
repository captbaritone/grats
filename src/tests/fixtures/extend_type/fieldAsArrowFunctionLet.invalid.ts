/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export let greeting = (_: SomeType): string => {
  return `Hello World`;
};
