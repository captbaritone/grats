## input

```ts title="interfaces/tag/ImplementsTagWithoutTypeOrInterface.invalid.ts"
/** @gqlImplements Node */
function hello() {
  return "world";
}
```

## Output

```
src/tests/fixtures/interfaces/tag/ImplementsTagWithoutTypeOrInterface.invalid.ts:1:6 - error: `@gqlImplements` has been deprecated. Instead use `class MyType implements MyInterface`.

1 /** @gqlImplements Node */
       ~~~~~~~~~~~~~
```