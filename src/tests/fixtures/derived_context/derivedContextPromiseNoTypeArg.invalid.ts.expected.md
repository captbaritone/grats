## input

```ts title="derived_context/derivedContextPromiseNoTypeArg.invalid.ts"
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext(ctx: RootContext): Promise {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlQueryField */
export function greeting(ctx: DerivedContext): string {
  return ctx.greeting;
}
```

## Output

### Error Report

```text
src/tests/fixtures/derived_context/derivedContextPromiseNoTypeArg.invalid.ts:11:63 - error: Expected `Promise` type to have exactly one type argument. Grats needs to be able to see the inner type in order to generate a GraphQL schema.

11 export async function createDerivedContext(ctx: RootContext): Promise {
                                                                 ~~~~~~~
```