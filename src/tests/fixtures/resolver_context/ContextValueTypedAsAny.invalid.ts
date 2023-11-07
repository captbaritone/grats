/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: any): string {
    return ctx.greeting;
  }
}
