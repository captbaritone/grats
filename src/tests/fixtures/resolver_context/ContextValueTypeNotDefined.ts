/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: ThisIsNeverDefined): string {
    return ctx.greeting;
  }
}
