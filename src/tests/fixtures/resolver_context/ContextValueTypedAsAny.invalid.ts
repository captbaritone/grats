/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: any): string {
    return ctx.greeting;
  }
}
