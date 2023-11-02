/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(args: never): string {
    console.log("hello");
    return "Hello world!";
  }
}
