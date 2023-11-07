/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: unknown): string {
    console.log("hello");
    return "Hello world!";
  }
}
