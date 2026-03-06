# enums/EnumFromConstArrayTypeQueryInvalidGraphQLName.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayTypeQueryInvalidGraphQLName.invalid.ts"
const ALL_SHOW_STATUSES = ["draft-status"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayTypeQueryInvalidGraphQLName.invalid.ts:1:28 - error: Names must only contain [_a-zA-Z0-9] but "draft-status" does not.

1 const ALL_SHOW_STATUSES = ["draft-status"] as const;
                             ~~~~~~~~~~~~~~
```