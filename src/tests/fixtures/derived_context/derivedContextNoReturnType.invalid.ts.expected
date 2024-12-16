-----------------
INPUT
----------------- 
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export function createDerivedContext(ctx: RootContext) {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: DerivedContext): string {
  return ctx.greeting;
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/derived_context/derivedContextNoReturnType.invalid.ts:11:1 - error: Expected derived resolver to have an explicit return type. This is needed to allow Grats to "see" which type to treat as a derived context type.

11 export function createDerivedContext(ctx: RootContext) {
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
12   return { greeting: `Hello, ${ctx.userName}!` };
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
13 }
   ~
