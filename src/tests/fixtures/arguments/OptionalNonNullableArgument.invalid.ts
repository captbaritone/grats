/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting?: string }): string {
    return `${greeting ?? "Hello"} World!`;
  }
}
