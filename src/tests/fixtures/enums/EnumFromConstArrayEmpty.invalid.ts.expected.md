# enums/EnumFromConstArrayEmpty.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayEmpty.invalid.ts"
const ALL_STATUSES = [] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayEmpty.invalid.ts:4:1 - error: Enum type ShowStatus must define one or more values.

4 type ShowStatus = (typeof ALL_STATUSES)[number];
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```