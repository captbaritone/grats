// trim-start
/** @gqlType */
// trim-end
class MyClass {
  /** @gqlField */
  myField(
    /** @deprecated Unused! */
    greeting?: string | null,
  ): string {
    return `Hello World`;
  }
}
