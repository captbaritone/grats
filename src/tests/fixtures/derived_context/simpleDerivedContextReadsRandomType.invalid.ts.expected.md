## input

```ts title="derived_context/simpleDerivedContextReadsRandomType.invalid.ts"
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
  oops: string,
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

```
src/tests/fixtures/derived_context/simpleDerivedContextReadsRandomType.invalid.ts:13:3 - error: Invalid type for derived context function argument. Derived context functions may only accept other `@gqlContext` types as arguments.

13   oops: string,
     ~~~~~~~~~~~~
```