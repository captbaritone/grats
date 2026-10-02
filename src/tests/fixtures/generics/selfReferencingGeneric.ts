// A generic type may reference itself with its own type parameter.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Node<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  next: Node<T> | null;
};

/** @gqlQueryField */
export function list(): Node<User> {
  return null as any;
}
