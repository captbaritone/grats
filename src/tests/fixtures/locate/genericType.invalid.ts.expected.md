## input

```ts title="locate/genericType.invalid.ts"
// Locate: PageEdge

/** @gqlType */
type Page = {
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
src/tests/fixtures/locate/genericType.invalid.ts:20:10 - error: Located here

20   edges: Edge<Page>[];
            ~~~~~~~~~~
```