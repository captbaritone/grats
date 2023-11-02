/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(ctx: GratsContext): string {
    return ctx.greeting;
  }
}
