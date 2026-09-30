# user_error/MultipleSyntaxErrors.invalid.ts

## Input

```ts title="user_error/MultipleSyntaxErrors.invalid.ts"
/** @gqlType */
class Foo {
  /** @gqlField */
  bar: Array<>;
  /** @gqlField */
  baz(...args?: string[]): string {
    return "";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/user_error/MultipleSyntaxErrors.invalid.ts:4:13 - error: Type argument list cannot be empty.

4   bar: Array<>;
              ~~
src/tests/fixtures/user_error/MultipleSyntaxErrors.invalid.ts:6:14 - error: A rest parameter cannot be optional

6   baz(...args?: string[]): string {
               ~
```