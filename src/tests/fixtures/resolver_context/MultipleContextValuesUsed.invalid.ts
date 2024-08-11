/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlContext */
type AlsoGratsContext = {
  greeting: string;
};

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: GratsContext): string {
    return ctx.greeting;
  }
  /** @gqlField */
  alsoGreeting(ctx: AlsoGratsContext): string {
    return ctx.greeting;
  }
}
