/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: never): string {
    return ctx.greeting;
  }
}
