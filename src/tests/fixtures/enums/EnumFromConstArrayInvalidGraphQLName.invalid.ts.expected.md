# enums/EnumFromConstArrayInvalidGraphQLName.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayInvalidGraphQLName.invalid.ts"
const ALL_STATUSES = ["valid", "123invalid"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayInvalidGraphQLName.invalid.ts:1:32 - error: Names must start with [_a-zA-Z] but "123invalid" does not.

1 const ALL_STATUSES = ["valid", "123invalid"] as const;
                                 ~~~~~~~~~~~~
```