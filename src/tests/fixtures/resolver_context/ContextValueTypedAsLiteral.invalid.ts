/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx: { greeting: string }): string {
    return ctx.greeting;
  }
}
