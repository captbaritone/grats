/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: { greeting: string }, alsoArgs: { farewell: string }): string {
    return "Hello world!";
  }
}
