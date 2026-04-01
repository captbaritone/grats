# enums/EnumFromConstArrayDuplicateValues.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayDuplicateValues.invalid.ts"
const ALL_STATUSES = ["DRAFT", "PUBLISHED", "DRAFT"] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayDuplicateValues.invalid.ts:1:23 - error: Enum value "ShowStatus.DRAFT" can only be defined once.

1 const ALL_STATUSES = ["DRAFT", "PUBLISHED", "DRAFT"] as const;
                        ~~~~~~~

  src/tests/fixtures/enums/EnumFromConstArrayDuplicateValues.invalid.ts:1:45
    1 const ALL_STATUSES = ["DRAFT", "PUBLISHED", "DRAFT"] as const;
                                                  ~~~~~~~
    Related location
```