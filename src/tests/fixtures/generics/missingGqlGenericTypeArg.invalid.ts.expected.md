# generics/missingGqlGenericTypeArg.invalid.ts

## Input

```ts title="generics/missingGqlGenericTypeArg.invalid.ts"
/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
export type PageConnection = {
  /** @gqlField */
  edges: Edge</* Oops! */>[];
};
```

## Output

### Error Report

```text
src/tests/fixtures/generics/missingGqlGenericTypeArg.invalid.ts:12:14 - error: Type argument list cannot be empty.

12   edges: Edge</* Oops! */>[];
                ~~~~~~~~~~~~~
```