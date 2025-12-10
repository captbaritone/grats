## input

```ts title="type_definitions/TagAttachedToWrongNode.invalid.ts"
/** @gqlType */
function MyFunc() {}
```

## Output

### Error Report

```text
src/tests/fixtures/type_definitions/TagAttachedToWrongNode.invalid.ts:1:5 - error: `@gqlType` can only be used on class, interface or type declarations. e.g. `class MyType {}`

1 /** @gqlType */
      ~~~~~~~~~
```