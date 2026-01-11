# input_types/DeprecatedInputType.invalid.ts

## Input

```ts title="input_types/DeprecatedInputType.invalid.ts"
/** @gqlType */
export class SomeType {
  /** @gqlField */
  hello: string;
}

/**
 * Check out this great input!
 * @gqlInput
 * @deprecated This old thing?
 */
type MyInputType = {
  someField: string;
};
```

## Output

### Error Report

```text
src/tests/fixtures/input_types/DeprecatedInputType.invalid.ts:10:5 - error: Directive "@deprecated" may not be used on INPUT_OBJECT.

10  * @deprecated This old thing?
       ~~~~~~~~~~
```