export type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ctx: GratsContext): string {
    return ctx.greeting;
  }
}
