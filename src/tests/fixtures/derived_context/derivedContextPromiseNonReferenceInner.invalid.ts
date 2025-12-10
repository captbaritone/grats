/** @gqlContext */
type RootContext = {
  userName: string;
};

/** @gqlContext */
export async function createDerivedContext(
  ctx: RootContext,
): Promise<{ greeting: string }> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: { greeting: string }): string {
  return ctx.greeting;
}
