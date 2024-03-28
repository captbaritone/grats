/** @gqlType */
type Page = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
export interface Edge<T> {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function createEdge(_: Query): Edge<Page> {
  return { node: { name: "My Page" }, cursor: "cursor" };
}
