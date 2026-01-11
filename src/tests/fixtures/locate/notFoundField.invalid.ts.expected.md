# locate/notFoundField.invalid.ts

## Input

```ts title="locate/notFoundField.invalid.ts"
// Locate: User.not_a_field
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

## Output

### Error Locating Type

```text
Cannot locate field `not_a_field` on type `User`.
```