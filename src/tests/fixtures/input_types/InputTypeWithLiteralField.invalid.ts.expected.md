# input_types/InputTypeWithLiteralField.invalid.ts

## Input

```ts title="input_types/InputTypeWithLiteralField.invalid.ts"
/** @gqlInput */
type MyInput = {
  flag: true;
};
```

## Output

### Error Report

```text
src/tests/fixtures/input_types/InputTypeWithLiteralField.invalid.ts:3:9 - error: Literal types like `true`, `"hello"`, or `42` cannot be used in GraphQL input positions (e.g., field arguments). GraphQL has no way to enforce that only this specific value is passed. Use the broader type (`Boolean`, `String`, `Int`, etc.) instead.

3   flag: true;
          ~~~~
```