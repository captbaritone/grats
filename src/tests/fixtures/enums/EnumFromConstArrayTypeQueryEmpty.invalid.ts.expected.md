# enums/EnumFromConstArrayTypeQueryEmpty.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayTypeQueryEmpty.invalid.ts"
const ALL_SHOW_STATUSES = [] as const;

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayTypeQueryEmpty.invalid.ts:1:27 - error: Expected `@gqlEnum` const array to include at least one string literal value. For example: `const VALUES = ["foo"] as const; type MyEnum = typeof VALUES[number]`.

1 const ALL_SHOW_STATUSES = [] as const;
                            ~~
```