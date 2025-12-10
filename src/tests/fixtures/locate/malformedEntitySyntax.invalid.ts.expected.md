## input

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
Invalid entity name: `User->name`. Expected `ParentType` or `ParentType.fieldName`.
```