/** @gqlType */
export type Page = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type User = {
  /** @gqlField */
  pages: Connection<Page>;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type Connection<T> = {
  /** @gqlField */
  edges: Edge<T>;
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
