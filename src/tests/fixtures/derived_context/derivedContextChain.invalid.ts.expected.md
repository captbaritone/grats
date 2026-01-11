# derived_context/derivedContextChain.invalid.ts

## Input

```ts title="derived_context/derivedContextChain.invalid.ts"
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
```

## Output

### Error Report

```text
src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:6:5 - error: Cyclic dependency detected in derived context. This derived context value depends upon itself.

6 /** @gqlContext */
      ~~~~~~~~~~~~

  src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:23:3
    23   a: DerivedContextA,
         ~~~~~~~~~~~~~~~~~~
    This derived context depends on
  src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:24:3
    24   b: DerivedContextB,
         ~~~~~~~~~~~~~~~~~~
    Which in turn depends on
  src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:14:39
    14 export function createDerivedContextB(ctx: DerivedContextA): DerivedContextB {
                                             ~~~~~~~~~~~~~~~~~~~~
    Which ultimately creates a cycle back to the initial derived context
src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:6:5 - error: Cyclic dependency detected in derived context. This derived context value depends upon itself.

6 /** @gqlContext */
      ~~~~~~~~~~~~

  src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:23:3
    23   a: DerivedContextA,
         ~~~~~~~~~~~~~~~~~~
    This derived context depends on
  src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:24:3
    24   b: DerivedContextB,
         ~~~~~~~~~~~~~~~~~~
    Which in turn depends on
  src/tests/fixtures/derived_context/derivedContextChain.invalid.ts:14:39
    14 export function createDerivedContextB(ctx: DerivedContextA): DerivedContextB {
                                             ~~~~~~~~~~~~~~~~~~~~
    Which ultimately creates a cycle back to the initial derived context
```