/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(args: unknown): string {
    console.log("hello");
    return "Hello world!";
  }
}
