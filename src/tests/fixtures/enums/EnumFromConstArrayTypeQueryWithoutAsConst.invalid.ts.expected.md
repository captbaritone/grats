# enums/EnumFromConstArrayTypeQueryWithoutAsConst.invalid.ts

## Input

```ts title="enums/EnumFromConstArrayTypeQueryWithoutAsConst.invalid.ts"
const ALL_SHOW_STATUSES = ["draft", "scheduled", "unlisted", "published"];

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumFromConstArrayTypeQueryWithoutAsConst.invalid.ts:4:19 - error: Expected `@gqlEnum` to be a union type, a string literal in the edge case of a single value enum, or a const array member type query. For example: `type MyEnum = "foo" | "bar"`, `type MyEnum = "foo"`, or `const VALUES = ["foo", "bar"] as const; type MyEnum = typeof VALUES[number]`.

If you think Grats should be able to infer this union, please report an issue at https://github.com/captbaritone/grats/issues.

4 type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```