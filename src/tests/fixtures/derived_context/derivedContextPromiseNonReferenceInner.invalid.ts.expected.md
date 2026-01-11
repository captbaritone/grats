# derived_context/derivedContextPromiseNonReferenceInner.invalid.ts

## Input

```ts title="derived_context/derivedContextPromiseNonReferenceInner.invalid.ts"
/** @gqlContext */
type RootContext = {
  userName: string;
};

/** @gqlContext */
export async function createDerivedContext(
  ctx: RootContext,
): Promise<{ greeting: string }> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: { greeting: string }): string {
  return ctx.greeting;
}
```

## Output

### Error Report

```text
src/tests/fixtures/derived_context/derivedContextPromiseNonReferenceInner.invalid.ts:9:12 - error: Expected derived resolver's return type to be a named type alias, e.g. `: SomeType`. This is needed to allow Grats to "see" which type declaration to treat as the derived context type.

9 ): Promise<{ greeting: string }> {
             ~~~~~~~~~~~~~~~~~~~~
```