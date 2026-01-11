# locate/type.invalid.ts

## Input

```ts title="locate/type.invalid.ts"
// Locate: User
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

## Output

### Error Report

```text
src/tests/fixtures/locate/type.invalid.ts:3:6 - error: Located here

3 type User = {
       ~~~~
```