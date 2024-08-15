/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting: string = "Hello"): string {
    return `${greeting} World`;
  }
}
