## input

```ts title="locate/notFoundField.invalid.ts"
// Locate: User.not_a_field
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

## Output

```
Cannot locate field `not_a_field` on type `User`.
```