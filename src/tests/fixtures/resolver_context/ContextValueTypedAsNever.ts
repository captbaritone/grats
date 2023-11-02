/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx: never): string {
    return ctx.greeting;
  }
}
