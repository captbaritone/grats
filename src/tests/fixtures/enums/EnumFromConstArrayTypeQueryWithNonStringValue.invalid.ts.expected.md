# enums/EnumFromConstArrayTypeQueryWithNonStringValue.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayTypeQueryWithNonStringValue.invalid.ts"
const ALL_SHOW_STATUSES = ["draft", 42] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayTypeQueryWithNonStringValue.invalid.ts:1:37 - error: Expected `@gqlEnum` enum members to be string literal types. For example: `'foo'`. Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.

If you think Grats should be able to infer this union member, please report an issue at https://github.com/captbaritone/grats/issues.

1 const ALL_SHOW_STATUSES = ["draft", 42] as const;
                                      ~~
```