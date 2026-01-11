# comments/detachedBlockCommentWithKillsParent.invalid.ts

## Input

```ts title="comments/detachedBlockCommentWithKillsParent.invalid.ts"
/**
 * @killsParentOnException
 */
/**
 * Foo
 */
```

## Output

### Error Report

```text
src/tests/fixtures/comments/detachedBlockCommentWithKillsParent.invalid.ts:2:4 - error: Unexpected Grats tag in detached docblock. Grats was unable to determine which TypeScript declaration this docblock is associated with. Moving the docblock to a position that is unambiguously "above" the relevant declaration may help. For more information see: https://grats.capt.dev/docs/getting-started/comment-syntax

2  * @killsParentOnException
     ~~~~~~~~~~~~~~~~~~~~~~~
```