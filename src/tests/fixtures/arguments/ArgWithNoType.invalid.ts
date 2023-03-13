/** @GQLType */
export default class Query {
  /** @GQLField */
  hello({ greeting }: { greeting }): string {
    return "Hello world!";
  }
}
