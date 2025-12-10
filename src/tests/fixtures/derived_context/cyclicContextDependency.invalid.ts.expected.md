## input

```ts title="derived_context/cyclicContextDependency.invalid.ts"
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export function createDerivedContext(
  ctx: RootContext,
  oops: DerivedContext,
): DerivedContext {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: DerivedContext): string {
  return ctx.greeting;
}
```

## Output

### Error Report

```text
src/tests/fixtures/derived_context/cyclicContextDependency.invalid.ts:10:5 - error: Cyclic dependency detected in derived context. This derived context value depends upon itself.

10 /** @gqlContext */
       ~~~~~~~~~~~~

  src/tests/fixtures/derived_context/cyclicContextDependency.invalid.ts:13:3
    13   oops: DerivedContext,
         ~~~~~~~~~~~~~~~~~~~~
    This derived context depends on itself
```