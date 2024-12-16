/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export function greetingContext(ctx: RootContext): DerivedContext {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: DerivedContext): string {
  return ctx.greeting;
}

/** @gqlField */
export function farewell(_: Query, ctx: DerivedContext): string {
  return `${ctx.greeting}... NOT!`;
}
