## input

```ts title="derived_context/derivedContextNonNamedReturnType.invalid.ts"
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export function createDerivedContext(ctx: RootContext): { greeting: string } {
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
src/tests/fixtures/derived_context/derivedContextNonNamedReturnType.invalid.ts:11:57 - error: Expected derived resolver's return type to be a named type alias, e.g. `: SomeType`. This is needed to allow Grats to "see" which type declaration to treat as the derived context type.

11 export function createDerivedContext(ctx: RootContext): { greeting: string } {
                                                           ~~~~~~~~~~~~~~~~~~~~
```