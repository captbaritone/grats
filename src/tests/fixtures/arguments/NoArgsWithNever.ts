/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(args: never, ctx: any): string {
    console.log(ctx);
    return "Hello world!";
  }
}
