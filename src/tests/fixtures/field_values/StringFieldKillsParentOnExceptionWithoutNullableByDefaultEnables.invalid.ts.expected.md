## input

```ts title="field_values/StringFieldKillsParentOnExceptionWithoutNullableByDefaultEnables.invalid.ts"
// { "nullableByDefault": false }
/** @gqlType */
export default class SomeType {
  /**
   * @gqlField
   * @killsParentOnException
   */
  hello(): string {
    return "Hello world!";
  }
}
```

## Output

```
src/tests/fixtures/field_values/StringFieldKillsParentOnExceptionWithoutNullableByDefaultEnables.invalid.ts:6:7 - error: Unexpected `@killsParentOnException` tag. `@killsParentOnException` is only supported when the Grats config option `nullableByDefault` is enabled in your `tsconfig.json`.

6    * @killsParentOnException
        ~~~~~~~~~~~~~~~~~~~~~~
```