# comments/nonJSDocBlockComment.invalid.ts

## Input

```ts title="comments/nonJSDocBlockComment.invalid.ts"
// Oops! Forgot to use two asterisks for the JSDoc block comment.

/* @gqlType */
class Composer {}
```

## Output

### Error Report

```text
src/tests/fixtures/comments/nonJSDocBlockComment.invalid.ts:3:4 - error: Unexpected Grats tag in non-JSDoc-style block comment. Grats only looks for tags in JSDoc-style block comments which start with `/**`. For more information see: https://grats.capt.dev/docs/getting-started/comment-syntax

3 /* @gqlType */
     ~~~~~~~~
```

#### Code Action: "Convert to a docblock comment" (convert-block-comment-to-docblock-comment)

```diff
- Original
+ Fixed

@@ -2,3 +2,3 @@

- /* @gqlType */
+ /** @gqlType */
  class Composer {}
```

#### Applied Fixes

```text
  * Applied fix "Convert to a docblock comment" in grats/src/tests/fixtures/comments/nonJSDocBlockComment.invalid.ts
```

#### Fixed Text

```typescript
// Oops! Forgot to use two asterisks for the JSDoc block comment.

/** @gqlType */
class Composer {}
```