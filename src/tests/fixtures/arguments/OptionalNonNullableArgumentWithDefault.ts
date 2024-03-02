/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = "Hello" }: { greeting?: string }): string {
    return `${greeting ?? "Hello"} World!`;
  }
}
