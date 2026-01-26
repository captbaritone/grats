/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting: "hello"): string {
    return "Hello world!";
  }
}
