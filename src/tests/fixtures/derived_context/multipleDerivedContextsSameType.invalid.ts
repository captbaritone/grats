/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export function createDerivedContext(ctx: RootContext): DerivedContext {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlContext */
export function createAnotherDerivedContext(ctx: RootContext): DerivedContext {
  return { greeting: `Goodbye!, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: DerivedContext): string {
  return ctx.greeting;
}