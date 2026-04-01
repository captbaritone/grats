# enums/EnumFromConstObjectNotPreceding.invalid.ts

## Input

```ts title="enums/EnumFromConstObjectNotPreceding.invalid.ts"
const Status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

const OTHER = "something";

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstObjectNotPreceding.invalid.ts:9:15 - error: Expected the `const` declaration immediately before this `@gqlEnum` to be named `Status` (to match `typeof Status`), but found `OTHER`. The `const` referenced in the type must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema.

9 type Status = (typeof Status)[keyof typeof Status];
                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```