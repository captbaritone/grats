# user_error/GqlTagDoesNotExistTiedSuggestions.invalid.ts

## Input

```ts title="user_error/GqlTagDoesNotExistTiedSuggestions.invalid.ts"
// `@gqlFoo` is as close to `@gqlType` as to `@gqlField`, `@gqlEnum` and
// `@gqlUnion`. The first of the tags is suggested.
/** @gqlFoo */
```

## Output

### Error Report

```text
src/tests/fixtures/user_error/GqlTagDoesNotExistTiedSuggestions.invalid.ts:3:6 - error: `@gqlFoo` is not a valid Grats tag. Valid tags are: `@gqlType`, `@gqlField`, `@gqlScalar`, `@gqlInterface`, `@gqlEnum`, `@gqlUnion`, `@gqlInput`, `@gqlDirective`, `@gqlAnnotate`, `@gqlQueryField`, `@gqlMutationField`, `@gqlSubscriptionField`.

3 /** @gqlFoo */
       ~~~~~~
```

#### Code Action: "Change to @gqlType" (change-to-gqlType)

```diff
--- Original
+++ Fixed
@@ -2,2 +2,2 @@
 // `@gqlUnion`. The first of the tags is suggested.
-/** @gqlFoo */
+/** @gqlType */
```

#### Applied Fixes

```text
  * Applied fix "Change to @gqlType" in grats/src/tests/fixtures/user_error/GqlTagDoesNotExistTiedSuggestions.invalid.ts
```

#### Fixed Text

```typescript
// `@gqlFoo` is as close to `@gqlType` as to `@gqlField`, `@gqlEnum` and
// `@gqlUnion`. The first of the tags is suggested.
/** @gqlType */
```