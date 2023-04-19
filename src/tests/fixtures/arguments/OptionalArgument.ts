/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting }: { greeting?: string | null }): string {
    return `${greeting ?? "Hello"} World!`;
  }
}
