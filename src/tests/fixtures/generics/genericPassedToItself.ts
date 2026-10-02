// A generic type's instantiation may be passed as its own type argument.
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

/** @gqlQueryField */
export function edge(): Edge<Edge<User>> {
  return null as any;
}
