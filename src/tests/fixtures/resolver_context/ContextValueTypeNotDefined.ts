/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx: ThisIsNeverDefined): string {
    return ctx.greeting;
  }
}
