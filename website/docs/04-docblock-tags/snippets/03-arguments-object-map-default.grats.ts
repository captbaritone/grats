// trim-start
/** @gqlType */
// trim-end
class MyClass {
  /** @gqlField */
  myField({ greeting = "Hello" }: { greeting: string }): string {
    return `${greeting} World`;
  }
}
