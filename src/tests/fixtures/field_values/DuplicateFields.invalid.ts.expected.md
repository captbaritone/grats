## input

```ts title="field_values/DuplicateFields.invalid.ts"
// @ts-nocheck

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello(): Array<string> {
    return ["Hello world!"];
  }
}
```

## Output

```
src/tests/fixtures/field_values/DuplicateFields.invalid.ts:6:3 - error: Field "SomeType.hello" can only be defined once.

6   hello(): string {
    ~~~~~

  src/tests/fixtures/field_values/DuplicateFields.invalid.ts:10:3
    10   hello(): Array<string> {
         ~~~~~
    Related location
```