/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext1 = {
  greeting: string;
};
type DerivedContext2 = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext1(
  ctx: RootContext,
): Promise<DerivedContext1> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlContext */
export async function createDerivedContext2(
  ctx: DerivedContext1,
): Promise<DerivedContext2> {
  return { greeting: `Hello, ${ctx.greeting}!` };
}

/** @gqlQueryField */
export function greeting(ctx: DerivedContext2): string {
  return ctx.greeting;
}
