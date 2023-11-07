/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = "hello" }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
