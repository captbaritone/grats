/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting }: { greeting: { foo: string; bar: string } }): string {
    return "Hello world!";
  }
}
