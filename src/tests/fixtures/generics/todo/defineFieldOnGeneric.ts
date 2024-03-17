/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type Page = {
  /** @gqlField */
  title: string;
};

/**
 * Re-expose title directly on the edge
 * @gqlField */
export function title(edge: Edge<Page>): string {
  return edge.node.title;
}
