/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: string): string {
    return ctx;
  }
}
