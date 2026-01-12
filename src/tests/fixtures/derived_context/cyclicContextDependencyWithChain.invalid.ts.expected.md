# derived_context/cyclicContextDependencyWithChain.invalid.ts

## Input

```ts title="derived_context/cyclicContextDependencyWithChain.invalid.ts"
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
```

## Output

### Error Report

```text
src/tests/fixtures/derived_context/cyclicContextDependencyWithChain.invalid.ts:10:5 - error: Cyclic dependency detected in derived context. This derived context value depends upon itself.

10 /** @gqlContext */
       ~~~~~~~~~~~~

  src/tests/fixtures/derived_context/cyclicContextDependencyWithChain.invalid.ts:11:37
    11 export function a(ctx: RootContext, b: B): A {
                                           ~~~~
    This derived context depends on
  src/tests/fixtures/derived_context/cyclicContextDependencyWithChain.invalid.ts:20:37
    20 export function b(ctx: RootContext, c: C): B {
                                           ~~~~
    Which in turn depends on
  src/tests/fixtures/derived_context/cyclicContextDependencyWithChain.invalid.ts:29:37
    29 export function c(ctx: RootContext, a: A): C {
                                           ~~~~
    Which ultimately creates a cycle back to the initial derived context
```