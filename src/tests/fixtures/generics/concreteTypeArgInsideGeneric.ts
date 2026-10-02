// A generic type may pass concrete types, as well as its own type parameters,
// to other generic types.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
/** @gqlType */
type Post = {
  /** @gqlField */
  title: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};

/** @gqlType */
type Connection<T> = {
  /** @gqlField */
  edges: Edge<T>[];
  /** @gqlField */
  other: Edge<Post>;
};

/** @gqlQueryField */
export function users(): Connection<User> {
  return null as any;
}
