/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting }: { greeting }): string {
    return "Hello world!";
  }
}
