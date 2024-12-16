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

-----------------
OUTPUT
-----------------
src/tests/fixtures/derived_context/multipleDerivedContextsSameType.invalid.ts:6:1 - error: Multiple derived contexts defined for given type

6 type DerivedContext = {
  ~~~~~~~~~~~~~~~~~~~~~~~
7   greeting: string;
  ~~~~~~~~~~~~~~~~~~~
8 };
  ~~

  src/tests/fixtures/derived_context/multipleDerivedContextsSameType.invalid.ts:15:5
    15 /** @gqlContext */
           ~~~~~~~~~~~~
    One was defined here
  src/tests/fixtures/derived_context/multipleDerivedContextsSameType.invalid.ts:10:5
    10 /** @gqlContext */
           ~~~~~~~~~~~~
    Another here
