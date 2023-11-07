/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = String(Math.random()) }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
