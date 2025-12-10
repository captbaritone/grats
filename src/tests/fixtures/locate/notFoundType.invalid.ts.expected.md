## input

```ts title="locate/notFoundType.invalid.ts"
// Locate: WhoopsNotARealType
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

## Output

```
Cannot locate type `WhoopsNotARealType`.
```