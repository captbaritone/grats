/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: never): string {
    return ctx.greeting;
  }
}
