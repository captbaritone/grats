/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx): string {
    return ctx.greeting;
  }
}
