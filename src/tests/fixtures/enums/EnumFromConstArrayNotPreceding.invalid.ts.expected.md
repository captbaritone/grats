# enums/EnumFromConstArrayNotPreceding.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayNotPreceding.invalid.ts"
const ALL_STATUSES = ["DRAFT", "PUBLISHED"] as const;

const OTHER = "something";

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayNotPreceding.invalid.ts:6:19 - error: Expected the `const` declaration immediately before this `@gqlEnum` to be named `ALL_STATUSES` (to match `typeof ALL_STATUSES`), but found `OTHER`. The `const` referenced in the type must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema.

6 type ShowStatus = (typeof ALL_STATUSES)[number];
                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```