/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(args: {
    /** The greeting to use. */
    greeting: string;
  }): string {
    return `${args.greeting} world!`;
  }
}
