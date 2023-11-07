type GratsContext = {
  greeting: string;
};

type AlsoGratsContext = {
  greeting: string;
};

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ctx: GratsContext): string {
    return ctx.greeting;
  }
  /** @gqlField */
  alsoGreeting(args: unknown, ctx: AlsoGratsContext): string {
    return ctx.greeting;
  }
}
