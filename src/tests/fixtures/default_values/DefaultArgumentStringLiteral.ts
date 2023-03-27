/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting = "hello" }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
