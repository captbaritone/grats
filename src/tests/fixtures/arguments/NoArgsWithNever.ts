/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(args: never, ctx: any): string {
    console.log(ctx);
    return "Hello world!";
  }
}
