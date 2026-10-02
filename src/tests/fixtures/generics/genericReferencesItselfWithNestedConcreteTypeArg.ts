// A generic type may reference itself with nested type arguments which don't
// include its type parameter, since that doesn't expand infinitely.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};

/** @gqlType */
type Box<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  edgeBox: Box<Edge<User>>;
};

/** @gqlQueryField */
export function box(): Box<User> {
  return null as any;
}
