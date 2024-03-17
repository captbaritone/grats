/** @gqlUnion */
type Result<V, E> = V | E;

/** @gqlType */
type Err = {
  __typename: "Err";
  /** @gqlField */
  error: string;
};

/** @gqlType */
type Page = {
  __typename: "Page";
  /** @gqlField */
  title: string;
};

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function pageResult(_: Query): Result<Page, Err> {
  return { title: "Hello", __typename: "Page" };
}
