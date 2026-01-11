# field_definitions/MethodFieldMissingType.invalid.ts

## Input

```ts title="field_definitions/MethodFieldMissingType.invalid.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  someMethodField() {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/MethodFieldMissingType.invalid.ts:4:3 - error: Expected GraphQL field methods to have an explicitly defined return type. Grats needs to be able to see the type of the field to generate its type in the GraphQL schema.

4   someMethodField() {
    ~~~~~~~~~~~~~~~
```