/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx: any): string {
    return ctx.greeting;
  }
}
