/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(count: 42): string {
    return "Hello world!";
  }
}
