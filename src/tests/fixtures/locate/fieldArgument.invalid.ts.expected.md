# locate/fieldArgument.invalid.ts

## Input

```ts title="locate/fieldArgument.invalid.ts"
// Locate: Query.greeting(salutation:)
/** @gqlType */
type Query = unknown;

/** @gqlQueryField */
export function greeting(salutation: string): string {
  return `${salutation}, world!`;
}
```

## Output

### Error Report

```text
src/tests/fixtures/locate/fieldArgument.invalid.ts:6:26 - error: Located here

6 export function greeting(salutation: string): string {
                           ~~~~~~~~~~
```