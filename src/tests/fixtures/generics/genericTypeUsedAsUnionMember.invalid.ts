/** @gqlType */
type Page = {
  __typename: "Page";
  /** @gqlField */
  name: string;
};

/** @gqlType */
export class Edge<T> {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
}

/** @gqlUnion */
type SomeUnion = Page | Edge<Page>;
