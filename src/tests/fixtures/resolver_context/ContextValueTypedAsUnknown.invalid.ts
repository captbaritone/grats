/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: unknown): string {
    return ctx.greeting;
  }
}
