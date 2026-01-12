# custom_scalars/SpecifiedByMissingUrlinvalid.invalid.ts

## Input

```ts title="custom_scalars/SpecifiedByMissingUrlinvalid.invalid.ts"
/**
 * @gqlScalar
 * @gqlAnnotate specifiedBy
 */
export type UUID = string;
```

## Output

### Error Report

```text
src/tests/fixtures/custom_scalars/SpecifiedByMissingUrlinvalid.invalid.ts:3:4 - error: Directive "@specifiedBy" argument "url" of type "String!" is required, but it was not provided.

3  * @gqlAnnotate specifiedBy
     ~~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~
```