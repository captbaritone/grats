/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx: string): string {
    return ctx;
  }
}
