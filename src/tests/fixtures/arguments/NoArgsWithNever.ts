/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: never): string {
    console.log("hello");
    return "Hello world!";
  }
}
