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
