# user_error/WrongCaseGqlTag.invalid.ts

## Input

```ts title="user_error/WrongCaseGqlTag.invalid.ts"
/** @GQLField */
function field() {}
```

## Output

### Error Report

```text
src/tests/fixtures/user_error/WrongCaseGqlTag.invalid.ts:1:6 - error: Incorrect casing for Grats tag `@GQLField`. Use `@gqlField` instead.

1 /** @GQLField */
       ~~~~~~~~
```

#### Code Action: "Change to @gqlField" (fix-grats-tag-casing)

```diff
- Original
+ Fixed

@@ -1,2 +1,2 @@
- /** @GQLField */
+ /** @gqlField */
  function field() {}
```

#### Applied Fixes

```text
  * Applied fix "Change to @gqlField" in grats/src/tests/fixtures/user_error/WrongCaseGqlTag.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlField */
function field() {}
```