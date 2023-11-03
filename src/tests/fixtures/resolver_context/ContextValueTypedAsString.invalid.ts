/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx: string): string {
    return ctx;
  }
}
