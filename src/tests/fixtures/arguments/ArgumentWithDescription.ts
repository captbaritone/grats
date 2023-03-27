/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(args: {
    /** The greeting to use. */
    greeting: string;
  }): string {
    return `${args.greeting} world!`;
  }
}
