/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx: never): string {
    return ctx.greeting;
  }
}
