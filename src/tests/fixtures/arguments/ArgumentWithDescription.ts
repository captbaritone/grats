/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: {
    /** The greeting to use. */
    greeting: string;
  }): string {
    return `${args.greeting} world!`;
  }
}
