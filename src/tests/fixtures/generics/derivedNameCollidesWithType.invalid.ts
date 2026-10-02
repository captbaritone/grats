// The name Grats derives for `Edge<User>` collides with the `UserEdge` type.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type UserEdge = {
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};

/** @gqlQueryField */
export function edge(): Edge<User> {
  return null as any;
}

/** @gqlQueryField */
export function userEdge(): UserEdge {
  return null as any;
}
