# derived_context/derivedContextPromiseTooManyTypeArgs.invalid.ts

## Input

```ts title="derived_context/derivedContextPromiseTooManyTypeArgs.invalid.ts"
/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext(
  ctx: RootContext,
  // @ts-expect-error - Promise only takes one type argument
): Promise<DerivedContext, string> {
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
src/tests/fixtures/derived_context/derivedContextPromiseTooManyTypeArgs.invalid.ts:14:4 - error: Expected `Promise` type to have exactly one type argument. Grats needs to be able to see the inner type in order to generate a GraphQL schema.

14 ): Promise<DerivedContext, string> {
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```