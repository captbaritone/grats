// trim-start
/** @gqlType */
// trim-end
class MyClass {
  /** @gqlField */
  myField(greeting: string = "Hello"): string {
    return `${greeting} World`;
  }
}
