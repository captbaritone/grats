# comments/GqlTagOnMemberOfNonEnumUnion.invalid.ts

## Input

```ts title="comments/GqlTagOnMemberOfNonEnumUnion.invalid.ts"
type NotAnEnum =
  /** @gqlType */
  "A" | "B";
```

## Output

### Error Report

```text
src/tests/fixtures/comments/GqlTagOnMemberOfNonEnumUnion.invalid.ts:2:7 - error: `@gqlType` can only be used on class, interface or type declarations. e.g. `class MyType {}`

2   /** @gqlType */
        ~~~~~~~~~
```