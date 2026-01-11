# locate/notFoundType.invalid.ts

## Input

```ts title="locate/notFoundType.invalid.ts"
// Locate: WhoopsNotARealType
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

## Output

### Error Locating Type

```text
Cannot locate type `WhoopsNotARealType`.
```