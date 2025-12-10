## input

```ts title="input_type_one_of/oneOfDeprecated.invalid.ts"
/**
 * @gqlInput
 * @deprecated Don't use this any more
 */
export type Greeting = { firstName: string } | { lastName: string };
```

## Output

### Error Report

```text
src/tests/fixtures/input_type_one_of/oneOfDeprecated.invalid.ts:3:5 - error: Directive "@deprecated" may not be used on INPUT_OBJECT.

3  * @deprecated Don't use this any more
      ~~~~~~~~~~
```