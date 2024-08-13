/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = (_: SomeType): string => {
    return `Hello World`;
  },
  anotherGreeting = (_: SomeType): string => {
    return `Hello World`;
  };
