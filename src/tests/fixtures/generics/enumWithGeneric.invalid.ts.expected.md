## input

```ts title="generics/enumWithGeneric.invalid.ts"
/** @gqlEnum */
type MyEnum<T> = T | "someValue";
```

## Output

### Error Report

```text
src/tests/fixtures/generics/enumWithGeneric.invalid.ts:2:18 - error: Expected `@gqlEnum` enum members to be string literal types. For example: `'foo'`. Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.

If you think Grats should be able to infer this union member, please report an issue at https://github.com/captbaritone/grats/issues.

2 type MyEnum<T> = T | "someValue";
                   ~
```