/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: { greeting: Promise<string> }): string {
    return `${args.greeting} world!`;
  }
}
