/** @GQLType */
export default class Query {
  /** @GQLField */
  hello({ greeting = String(Math.random()) }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
