# locate/inputTypeField.invalid.ts

## Input

```ts title="locate/inputTypeField.invalid.ts"
// Locate: User.name
/** @gqlInput */
type User = {
  name: string;
};
```

## Output

### Error Report

```text
src/tests/fixtures/locate/inputTypeField.invalid.ts:4:3 - error: Located here

4   name: string;
    ~~~~
```