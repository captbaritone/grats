/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx): string {
    return ctx.greeting;
  }
}
