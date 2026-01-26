# arguments/LiteralBooleanArgument.invalid.ts

## Input

```ts title="arguments/LiteralBooleanArgument.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(flag: true): string {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/LiteralBooleanArgument.invalid.ts:4:15 - error: Literal types like `true`, `"hello"`, or `42` cannot be used in GraphQL input positions (e.g., field arguments). GraphQL has no way to enforce that only this specific value is passed. Use the broader type (`Boolean`, `String`, `Int`, etc.) instead.

4   hello(flag: true): string {
                ~~~~
```