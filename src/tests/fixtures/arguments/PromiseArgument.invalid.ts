/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(args: { greeting: Promise<string> }): string {
    return `${args.greeting} world!`;
  }
}
