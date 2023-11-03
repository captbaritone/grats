/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx): string {
    return ctx.greeting;
  }
}
