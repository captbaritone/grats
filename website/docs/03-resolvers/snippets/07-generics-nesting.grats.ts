// trim-start
/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type PageInfo = {
  /** @gqlField */
  hasNextPage: boolean;
};

// trim-end
/** @gqlType */
type Connection<T> = {
  /** @gqlField */
  edges: Edge<T>[];
  /** @gqlField */
  pageInfo: PageInfo;
};
