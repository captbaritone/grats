/** @gqlContext */
export type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx: GratsContext): string {
    return ctx.greeting;
  }
}
