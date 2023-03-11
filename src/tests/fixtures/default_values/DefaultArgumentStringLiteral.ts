/** @GQLType */
export default class Query {
  /** @GQLField */
  hello({ greeting = "hello" }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
