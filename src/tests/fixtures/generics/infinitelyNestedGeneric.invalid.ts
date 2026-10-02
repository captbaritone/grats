// A generic type which references itself with more deeply nested type
// arguments would expand into infinitely many types.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Tree<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  children: Tree<Tree<T>>;
};

/** @gqlQueryField */
export function tree(): Tree<User> {
  return null as any;
}
