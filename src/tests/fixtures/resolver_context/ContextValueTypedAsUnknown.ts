/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: unknown): string {
    return ctx.greeting;
  }
}
