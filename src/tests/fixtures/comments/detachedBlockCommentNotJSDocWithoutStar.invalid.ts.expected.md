## input

```ts title="comments/detachedBlockCommentNotJSDocWithoutStar.invalid.ts"
/*
   @gqlType
*/
/**
 * Foo
 */
```

## Output

### Error Report

```text
src/tests/fixtures/comments/detachedBlockCommentNotJSDocWithoutStar.invalid.ts:2:4 - error: Unexpected Grats tag in non-JSDoc-style block comment. Grats only looks for tags in JSDoc-style block comments which start with `/**`. For more information see: https://grats.capt.dev/docs/getting-started/comment-syntax

2    @gqlType
     ~~~~~~~~
```

#### Code Action: "Convert to a docblock comment" (convert-block-comment-to-docblock-comment)

```diff
- Original
+ Fixed

@@ -1,2 +1,2 @@
- /*
+ /**
     @gqlType
```

#### Applied Fixes

```text
* Applied fix "Convert to a docblock comment" in grats/src/tests/fixtures/comments/detachedBlockCommentNotJSDocWithoutStar.invalid.ts
```

#### Fixed Text

```typescript
/**
   @gqlType
*/
/**
 * Foo
 */
```