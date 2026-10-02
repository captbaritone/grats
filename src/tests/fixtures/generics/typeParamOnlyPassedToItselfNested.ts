// `Tree` passes its type parameter back to itself wrapped in another type, but
// doesn't use it in a GraphQL position, so it's not generic and doesn't expand
// infinitely.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Tree<T> = {
  /** @gqlField */
  children: Tree<Tree<T>>;
  notGql: T;
};

/** @gqlQueryField */
export function tree(): Tree<User> {
  return null as any;
}
