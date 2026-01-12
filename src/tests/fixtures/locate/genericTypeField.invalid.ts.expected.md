# locate/genericTypeField.invalid.ts

## Input

```ts title="locate/genericTypeField.invalid.ts"
// Locate: PageEdge.cursor

/** @gqlType */
export type Page = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type PageConnection = {
  /** @gqlField */
  edges: Edge<Page>[];
  /** @gqlField */
  pageInfo: PageInfo;
};

/** @gqlType */
type PageInfo = {
  /** @gqlField */
  hasNextPage: boolean;
  /** @gqlField */
  hasPreviousPage: boolean;
  /** @gqlField */
  startCursor: string;
  /** @gqlField */
  endCursor: string;
};
```

## Output

### Error Report

```text
src/tests/fixtures/locate/genericTypeField.invalid.ts:14:3 - error: Located here

14   cursor: string;
     ~~~~~~
```