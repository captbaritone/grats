# locate/malformedEntitySyntax.invalid.ts

## Input

```ts title="locate/malformedEntitySyntax.invalid.ts"
// Locate: User->name
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

## Output

### Error Locating Type

```text
Invalid schema coordinate: `User->name`. Syntax Error: Invalid character: "-".
```