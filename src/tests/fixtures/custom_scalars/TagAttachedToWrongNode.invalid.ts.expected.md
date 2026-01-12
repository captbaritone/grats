# custom_scalars/TagAttachedToWrongNode.invalid.ts

## Input

```ts title="custom_scalars/TagAttachedToWrongNode.invalid.ts"
/** @gqlScalar Matrix */
function Foo() {}
```

## Output

### Error Report

```text
src/tests/fixtures/custom_scalars/TagAttachedToWrongNode.invalid.ts:1:5 - error: `@gqlScalar` can only be used on type alias declarations. e.g. `type MyScalar = string`

1 /** @gqlScalar Matrix */
      ~~~~~~~~~~~~~~~~~~
```