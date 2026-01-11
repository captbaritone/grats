# field_definitions/FieldTagOnIncorrectNode.invalid.ts

## Input

```ts title="field_definitions/FieldTagOnIncorrectNode.invalid.ts"
class SomeType {
  /** @gqlField */
  constructor() {
    //
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/FieldTagOnIncorrectNode.invalid.ts:3:3 - error: `@gqlField` can only be used on method/property declarations, signatures, function or static method declarations.

If you think Grats should be able to infer this field, please report an issue at https://github.com/captbaritone/grats/issues.

3   constructor() {
    ~~~~~~~~~~~~~~~
4     //
  ~~~~~~
5   }
  ~~~
```