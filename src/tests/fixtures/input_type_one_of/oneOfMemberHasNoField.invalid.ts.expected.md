## input

```ts title="input_type_one_of/oneOfMemberHasNoField.invalid.ts"
/**
 * @gqlInput
 */
type Greeting = { firstName: string } | {};
```

## Output

### Error Report

```text
src/tests/fixtures/input_type_one_of/oneOfMemberHasNoField.invalid.ts:4:41 - error: Expected each member of a @oneOf @gqlInput to be a TypeScript object literal with exactly one property.

4 type Greeting = { firstName: string } | {};
                                          ~~
```