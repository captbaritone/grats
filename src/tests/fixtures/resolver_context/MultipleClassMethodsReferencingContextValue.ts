/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: GratsContext): string {
    return ctx.greeting;
  }

  /** @gqlField */
  alsoGreeting(args: unknown, ctx: GratsContext): string {
    return ctx.greeting;
  }
}
