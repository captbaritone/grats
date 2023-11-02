/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx: { greeting: string }): string {
    return ctx.greeting;
  }
}
