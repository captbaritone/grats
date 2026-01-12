# arguments/PositionalArgAndArgs.invalid.ts

## Input

```ts title="arguments/PositionalArgAndArgs.invalid.ts"
/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting: Greeting, args: { notGreeting: string }): string {
    return `${greeting.salutation} ${greeting.name} ${args.notGreeting}!`;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/PositionalArgAndArgs.invalid.ts:10:29 - error: Unexpected arguments object in resolver that is also using positional GraphQL arguments. Grats expects that either all GraphQL arguments will be defined in a single object, or that all GraphQL arguments will be defined using positional arguments. The two strategies may not be combined.

10   hello(greeting: Greeting, args: { notGreeting: string }): string {
                               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  src/tests/fixtures/arguments/PositionalArgAndArgs.invalid.ts:10:9
    10   hello(greeting: Greeting, args: { notGreeting: string }): string {
               ~~~~~~~~~~~~~~~~~~
    Positional GraphQL argument defined here
```