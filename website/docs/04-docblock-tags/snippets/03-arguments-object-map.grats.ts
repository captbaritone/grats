/** @gqlType */
class MyType {
  /** @gqlField */
  // highlight-start
  myField(args: { greeting: string }): string {
    // highlight-end
    return `${args.greeting} World`;
  }
}
