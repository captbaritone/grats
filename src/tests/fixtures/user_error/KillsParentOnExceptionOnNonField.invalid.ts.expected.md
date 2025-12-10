## input

```ts title="user_error/KillsParentOnExceptionOnNonField.invalid.ts"
/** @killsParentOnException */
const foo = "bar";

/** @gqlType */
type Foo = {
  /** @gqlField */
  bar: string;
};
```

## Output

```
src/tests/fixtures/user_error/KillsParentOnExceptionOnNonField.invalid.ts:1:6 - error: Unexpected `@killsParentOnException`. `@killsParentOnException` can only be used in field annotation docblocks. Perhaps you are missing a `@gqlField` tag?

1 /** @killsParentOnException */
       ~~~~~~~~~~~~~~~~~~~~~~
```