## input

```ts title="typename/MethodTypename.invalid.ts"
/** @gqlType */
class User {
  __typename() {
    return "User";
  }
  /** @gqlField */
  name: string = "Alice";
}
```

## Output

```
src/tests/fixtures/typename/MethodTypename.invalid.ts:3:3 - error: Expected `__typename` to be a property declaration. For example: `__typename: "MyType"`.

3   __typename() {
    ~~~~~~~~~~
```