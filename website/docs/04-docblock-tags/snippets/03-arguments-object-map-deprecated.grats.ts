// trim-start
/** @gqlType */
// trim-end
class MyClass {
  /** @gqlField */
  myField(_: {
    /** @deprecated Unused! */
    greeting?: string | null;
  }): string {
    return `Hello World`;
  }
}
