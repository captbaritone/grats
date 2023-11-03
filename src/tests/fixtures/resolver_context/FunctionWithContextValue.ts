type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class User {}

/** @gqlField */
export function greeting(_: User, args: never, ctx: GratsContext): string {
  return ctx.greeting;
}
