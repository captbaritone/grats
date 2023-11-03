type GratsContext = {
  greeting: string;
};

type AlsoGratsContext = {
  greeting: string;
};

/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx: GratsContext): string {
    return ctx.greeting;
  }
  /** @gqlField */
  alsoGreeting(args: never, ctx: AlsoGratsContext): string {
    return ctx.greeting;
  }
}
