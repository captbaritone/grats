## input

```ts title="field_values/OptionalStringFieldKillsParentOnException.invalid.ts"
/** @gqlType */
export default class SomeType {
  /**
   * @gqlField
   * @killsParentOnException
   */
  hello(): string | null {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_values/OptionalStringFieldKillsParentOnException.invalid.ts:5:7 - error: Unexpected `@killsParentOnException` tag on field typed as nullable. `@killsParentOnException` will force a field to appear as non-nullable in the schema, so its implementation must also be non-nullable. .

5    * @killsParentOnException
        ~~~~~~~~~~~~~~~~~~~~~~
```