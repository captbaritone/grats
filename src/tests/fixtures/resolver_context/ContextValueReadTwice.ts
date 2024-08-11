// No valid reason to do this, but just asserting that it works, since it happens to.

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: SomeOtherType, alsoContext: SomeOtherType): string {
    return ctx.greeting ?? "Hello, world!";
  }
}

/** @gqlContext */
type SomeOtherType = { greeting?: string };
