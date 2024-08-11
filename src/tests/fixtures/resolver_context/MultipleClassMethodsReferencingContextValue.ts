/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: GratsContext): string {
    return ctx.greeting;
  }

  /** @gqlField */
  alsoGreeting(ctx: GratsContext): string {
    return ctx.greeting;
  }
}
