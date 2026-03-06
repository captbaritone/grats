# enums/EnumFromConstArrayTypeQueryDuplicateValues.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayTypeQueryDuplicateValues.invalid.ts"
const ALL_SHOW_STATUSES = ["draft", "draft"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayTypeQueryDuplicateValues.invalid.ts:1:37 - error: Expected `@gqlEnum` enum members to be unique. Found duplicate value `draft`.

1 const ALL_SHOW_STATUSES = ["draft", "draft"] as const;
                                      ~~~~~~~

  src/tests/fixtures/enums/EnumFromConstArrayTypeQueryDuplicateValues.invalid.ts:1:28
    1 const ALL_SHOW_STATUSES = ["draft", "draft"] as const;
                                 ~~~~~~~
    Previous enum member with this value.
```