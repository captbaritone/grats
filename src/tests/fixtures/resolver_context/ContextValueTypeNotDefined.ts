/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx: ThisIsNeverDefined): string {
    return ctx.greeting;
  }
}
