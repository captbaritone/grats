/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class User {}

/** @gqlField */
export function greeting(_: User, ctx: GratsContext): string {
  return ctx.greeting;
}
