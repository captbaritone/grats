# comments/detachedBlockCommentWithoutStar.invalid.ts

## Input

```ts title="comments/detachedBlockCommentWithoutStar.invalid.ts"
/**
   @gqlType
*/
/**
 * Foo
 */
```

## Output

### Error Report

```text
src/tests/fixtures/comments/detachedBlockCommentWithoutStar.invalid.ts:2:4 - error: Unexpected Grats tag in detached docblock. Grats was unable to determine which TypeScript declaration this docblock is associated with. Moving the docblock to a position that is unambiguously "above" the relevant declaration may help. For more information see: https://grats.capt.dev/docs/getting-started/comment-syntax

2    @gqlType
     ~~~~~~~~
```