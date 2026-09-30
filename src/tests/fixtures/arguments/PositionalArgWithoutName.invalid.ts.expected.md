# arguments/PositionalArgWithoutName.invalid.ts

## Input

```ts title="arguments/PositionalArgWithoutName.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello([greeting]: string[]): string {
    return `${greeting} World`;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/PositionalArgWithoutName.invalid.ts:4:9 - error: Expected resolver argument to have a name. Grats needs to be able to see the name of the argument in order to derive a GraphQL argument name.

4   hello([greeting]: string[]): string {
          ~~~~~~~~~~
```