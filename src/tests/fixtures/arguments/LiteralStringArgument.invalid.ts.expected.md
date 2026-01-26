# arguments/LiteralStringArgument.invalid.ts

## Input

```ts title="arguments/LiteralStringArgument.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting: "hello"): string {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/LiteralStringArgument.invalid.ts:4:19 - error: Literal types like `true`, `"hello"`, or `42` cannot be used in GraphQL input positions (e.g., field arguments). GraphQL has no way to enforce that only this specific value is passed. Use the broader type (`Boolean`, `String`, `Int`, etc.) instead.

4   hello(greeting: "hello"): string {
                    ~~~~~~~
```