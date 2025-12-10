## input

```ts title="descriptions/RenameFollowedByDescription.invalid.ts"
/**
 * @gqlType User
 *
 * The user (oops, this should go up above!)
 */
class SomeType {
  /** @gqlField */
  name: string;
}
```

## Output

```
src/tests/fixtures/descriptions/RenameFollowedByDescription.invalid.ts:2:4 - error: Expected text following a `@gqlType` tag to be a GraphQL name. If you intended this text to be a description, place it at the top of the docblock before any `@tags`.

2  * @gqlType User
     ~~~~~~~~~~~~~
3  *
  ~~
4  * The user (oops, this should go up above!)
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
5  */
  ~
```