# field_definitions/FiledWithUnionOfMultipleTypes.invalid.ts

## Input

```ts title="field_definitions/FiledWithUnionOfMultipleTypes.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): string | boolean {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/FiledWithUnionOfMultipleTypes.invalid.ts:4:12 - error: Expected exactly one non-nullish type. GraphQL does not support fields returning an arbitrary union of types. Consider defining an explicit `@gqlUnion` union type and returning that.

4   hello(): string | boolean {
             ~~~~~~

  src/tests/fixtures/field_definitions/FiledWithUnionOfMultipleTypes.invalid.ts:4:21
    4   hello(): string | boolean {
                          ~~~~~~~
    Other non-nullish type
```