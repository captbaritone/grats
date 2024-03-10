/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: { greeting: AsyncIterable<string> }): string {
    return `${args.greeting} world!`;
  }
}
