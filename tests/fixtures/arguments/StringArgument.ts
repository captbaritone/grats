/** @GQLType */
export default class Query {
  /** @GQLField */
  hello({ greeting }: { greeting: string }): string {
    return "Hello world!";
  }
}
