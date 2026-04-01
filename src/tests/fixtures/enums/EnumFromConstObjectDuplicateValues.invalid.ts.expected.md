# enums/EnumFromConstObjectDuplicateValues.invalid.ts

## Input

```ts title="enums/EnumFromConstObjectDuplicateValues.invalid.ts"
const Status = {
  Draft: "DRAFT",
  AlsoDraft: "DRAFT",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstObjectDuplicateValues.invalid.ts:2:10 - error: Enum value "Status.DRAFT" can only be defined once.

2   Draft: "DRAFT",
           ~~~~~~~

  src/tests/fixtures/enums/EnumFromConstObjectDuplicateValues.invalid.ts:3:14
    3   AlsoDraft: "DRAFT",
                   ~~~~~~~
    Related location
```