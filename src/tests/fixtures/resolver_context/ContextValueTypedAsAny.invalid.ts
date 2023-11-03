/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx: any): string {
    return ctx.greeting;
  }
}
