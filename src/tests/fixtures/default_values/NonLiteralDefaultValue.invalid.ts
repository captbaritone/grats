/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting = String(Math.random()) }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
