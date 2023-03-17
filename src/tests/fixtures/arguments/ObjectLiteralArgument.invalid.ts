/** @GQLType */
export default class Query {
  /** @GQLField */
  hello({ greeting }: { greeting: { foo: string; bar: string } }): string {
    return "Hello world!";
  }
}
