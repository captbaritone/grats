## input

```ts title="locate/typeField.invalid.ts"
// Locate: User.name
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

## Output

```
src/tests/fixtures/locate/typeField.invalid.ts:5:3 - error: Located here

5   name: string;
    ~~~~
```