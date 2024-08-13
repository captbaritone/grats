/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = async (_: SomeType): Promise<string> => {
  return `Hello World`;
};
