# descriptions/DescriptionOnLineOfTypeTag.invalid.ts

## Input

```ts title="descriptions/DescriptionOnLineOfTypeTag.invalid.ts"
/**
 * @gqlType This is a note for myself
 */
export type Query = unknown;

/** @gqlField */
export function queryField(_: Query): string {
  return "";
}
```

## Output

### Error Report

```text
src/tests/fixtures/descriptions/DescriptionOnLineOfTypeTag.invalid.ts:2:4 - error: Expected text following a `@gqlType` tag to be a GraphQL name. If you intended this text to be a description, place it at the top of the docblock before any `@tags`.

2  * @gqlType This is a note for myself
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
3  */
  ~
```