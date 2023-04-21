/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting }: { greeting: [string] }): string {
    return "Hello world!";
  }
}
