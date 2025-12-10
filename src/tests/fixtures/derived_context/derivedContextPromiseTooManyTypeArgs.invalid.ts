/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext(
  ctx: RootContext,
  // @ts-expect-error - Promise only takes one type argument
): Promise<DerivedContext, string> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlQueryField */
export function greeting(ctx: DerivedContext): string {
  return ctx.greeting;
}
