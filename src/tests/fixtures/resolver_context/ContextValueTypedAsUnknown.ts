/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx: unknown): string {
    return ctx.greeting;
  }
}
