/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting?: string | null }): string {
    return `${greeting ?? "Hello"} World!`;
  }
}
