/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: ThisIsNeverDefined): string {
    return ctx.greeting;
  }
}
