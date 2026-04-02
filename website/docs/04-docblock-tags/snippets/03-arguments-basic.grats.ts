/** @gqlType */
class MyType {
  /** @gqlField */
  // highlight-start
  myField(greeting: string): string {
    // highlight-end
    return `${greeting} World`;
  }
}
