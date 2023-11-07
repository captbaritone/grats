/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: { greeting: string }): string {
    return ctx.greeting;
  }
}
