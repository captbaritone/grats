/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(args): string {
    return "Hello world!";
  }
}
