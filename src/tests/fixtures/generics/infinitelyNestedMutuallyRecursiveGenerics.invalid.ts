// Generic types which reference each other with more deeply nested type
// arguments would expand into infinitely many types.
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
type Parent<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  child: Child<T>;
};

/** @gqlType */
type Child<T> = {
  /** @gqlField */
  parent: Parent<Edge<T>>;
};

/** @gqlQueryField */
export function parent(): Parent<User> {
  return null as any;
}
