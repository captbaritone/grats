/** @gqlType */
type Page = {
  __typename: "Page";
  /** @gqlField */
  foo: SomeUnion<Edge<Page>>;
};

/** @gqlType */
export class Edge<T> {
  /** @gqlField */
  node: T;
}

/** @gqlUnion */
type SomeUnion<T> = Page | T;
