## input

```ts title="input_types/InputTypeWithDeprecatedRequiredField.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlInput */
type MyInputType = {
  /** Sweet field!
   * @deprecated Sweet, but stale
   */
  someField: string;
};
```

## Output

### Error Report

```text
src/tests/fixtures/input_types/InputTypeWithDeprecatedRequiredField.invalid.ts:10:7 - error: Required input field MyInputType.someField cannot be deprecated.

10    * @deprecated Sweet, but stale
         ~~~~~~~~~~

  src/tests/fixtures/input_types/InputTypeWithDeprecatedRequiredField.invalid.ts:12:14
    12   someField: string;
                    ~~~~~~
    Related location
```