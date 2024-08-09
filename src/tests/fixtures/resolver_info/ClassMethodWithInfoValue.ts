/** @gqlType */
export class SomeType {
  /** @gqlField greeting */
  greetz(args: unknown, ctx: unknown, info): string {
    return "Hello";
  }
}
