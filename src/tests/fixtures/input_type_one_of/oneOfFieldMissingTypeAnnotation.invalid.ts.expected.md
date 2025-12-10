## input

```ts title="input_type_one_of/oneOfFieldMissingTypeAnnotation.invalid.ts"
/**
 * @gqlInput
 */
export type Greeting = { firstName: string } | { lastName };
```

## Output

```
src/tests/fixtures/input_type_one_of/oneOfFieldMissingTypeAnnotation.invalid.ts:4:50 - error: Expected each property of a @oneOf @gqlInput to have a type annotation.

4 export type Greeting = { firstName: string } | { lastName };
                                                   ~~~~~~~~
```