/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext(ctx: RootContext): Promise {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlQueryField */
export function greeting(ctx: DerivedContext): string {
  return ctx.greeting;
}
