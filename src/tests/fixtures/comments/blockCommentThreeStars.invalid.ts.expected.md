# comments/blockCommentThreeStars.invalid.ts

## Input

```ts title="comments/blockCommentThreeStars.invalid.ts"
/*** @gqlType */
class User {}
```

## Output

### Error Report

```text
src/tests/fixtures/comments/blockCommentThreeStars.invalid.ts:2:7 - error: Type `User` must define one or more fields.

Define a field by adding `/** @gqlField */` above a field, property, attribute or method of this type, or above a function that has `User` as its first argument.

2 class User {}
        ~~~~
```