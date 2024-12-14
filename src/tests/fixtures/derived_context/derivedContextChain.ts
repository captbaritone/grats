/** @gqlContext */
type RootContext = { userName: string };

type DerivedContextA = { greeting: string };

/** @gqlContext */
export function createDerivedContextA(ctx: RootContext): DerivedContextA {
  return { greeting: `Hello, ${ctx.userName}!` };
}

type DerivedContextB = { greeting: string };

/** @gqlContext */
export function createDerivedContextB(ctx: DerivedContextA): DerivedContextB {
  return { greeting: ctx.greeting.toUpperCase() };
}

type EverythingContext = { greeting: string };

/** @gqlContext */
export function allTheContexts(
  root: RootContext,
  a: DerivedContextA,
  b: DerivedContextB,
): EverythingContext {
  return { greeting: `${root.userName} ${a.greeting} ${b.greeting}` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: EverythingContext): string {
  return ctx.greeting;
}

/** @gqlField */
export function consumingMultipleContexts(
  _: Query,
  root: RootContext,
  a: DerivedContextA,
  b: DerivedContextB,
  everything: EverythingContext,
): string {
  return `${root.userName} ${a.greeting} ${b.greeting} ${everything.greeting}`;
}
