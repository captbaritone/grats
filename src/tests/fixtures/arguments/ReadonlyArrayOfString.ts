/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greetings: readonly string[]): string {
    return `${greetings.join(", ")} world!`;
  }
}
