# enums/EnumFromConstObjectNonStringValue.invalid.ts

## Input

```ts title="enums/EnumFromConstObjectNonStringValue.invalid.ts"
const Status = {
  Draft: "DRAFT",
  Published: 42,
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstObjectNonStringValue.invalid.ts:3:3 - error: Expected `@gqlEnum` enum members to be string literal types. For example: `'foo'`. Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.

If you think Grats should be able to infer this enum value, please report an issue at https://github.com/captbaritone/grats/issues.

3   Published: 42,
    ~~~~~~~~~~~~~
```