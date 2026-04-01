# enums/EnumFromConstArrayWithoutAsConst.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayWithoutAsConst.invalid.ts"
const ALL_STATUSES = ["DRAFT", "PUBLISHED"];

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayWithoutAsConst.invalid.ts:4:19 - error: Expected the const declaration preceding this `@gqlEnum` to use `as const`. Grats needs the literal types to determine the enum values. For example: `const VALUES = ["FOO", "BAR"] as const;`

4 type ShowStatus = (typeof ALL_STATUSES)[number];
                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```