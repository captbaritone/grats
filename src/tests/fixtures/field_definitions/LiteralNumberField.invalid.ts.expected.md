# field_definitions/LiteralNumberField.invalid.ts

## Input

```ts title="field_definitions/LiteralNumberField.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): 42 {
    return 42;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/LiteralNumberField.invalid.ts:4:12 - error: Unexpected numeric literal type. GraphQL supports both Int and Float. To ensure Grats infers the correct type, use the `Int` or `Float` type from `grats` instead. e.g. `import type { Int, Float } from "grats";`.

4   hello(): 42 {
             ~~
```