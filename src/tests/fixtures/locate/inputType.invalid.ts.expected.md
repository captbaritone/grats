## input

```ts title="locate/inputType.invalid.ts"
// Locate: User
/** @gqlInput */
type User = {
  name: string;
};
```

## Output

### Error Report

```text
src/tests/fixtures/locate/inputType.invalid.ts:3:6 - error: Located here

3 type User = {
       ~~~~
```