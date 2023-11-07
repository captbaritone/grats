/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: string): string {
    return ctx;
  }
}
