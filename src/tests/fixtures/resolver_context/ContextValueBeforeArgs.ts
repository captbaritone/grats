/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: SomeOtherType, args: { fallbackGreeting: string }): string {
    return ctx.greeting ?? args.fallbackGreeting;
  }
}

/** @gqlContext */
type SomeOtherType = { greeting?: string };
