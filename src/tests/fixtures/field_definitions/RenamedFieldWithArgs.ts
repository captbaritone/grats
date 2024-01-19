/** @gqlType */
export default class SomeType {
  /** @gqlField greetz */
  hello(args: { greeting: string }): string {
    return `${args.greeting} world!`;
  }
}
