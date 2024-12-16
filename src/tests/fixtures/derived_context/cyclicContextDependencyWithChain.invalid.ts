/** @gqlContext */
type RootContext = {
  userName: string;
};

type A = {
  greeting: string;
};

/** @gqlContext */
export function a(ctx: RootContext, b: B): A {
  return { greeting: `Hello, ${ctx.userName}!` };
}

type B = {
  greeting: string;
};

/** @gqlContext */
export function b(ctx: RootContext, c: C): B {
  return { greeting: `Hello, ${ctx.userName}!` };
}

type C = {
  greeting: string;
};

/** @gqlContext */
export function c(ctx: RootContext, a: A): C {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: A): string {
  return ctx.greeting;
}
