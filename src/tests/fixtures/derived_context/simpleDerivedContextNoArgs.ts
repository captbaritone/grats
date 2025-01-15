/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export function createDerivedContext(): DerivedContext {
  return { greeting: `Hello!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: DerivedContext): string {
  return ctx.greeting;
}
