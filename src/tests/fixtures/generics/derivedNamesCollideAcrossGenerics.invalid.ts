// `Edge<UserConnection>` and `ConnectionEdge<User>` would both be named
// `UserConnectionEdge`.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
/** @gqlType */
type UserConnection = {
  /** @gqlField */
  count: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};
/** @gqlType */
type ConnectionEdge<T> = {
  /** @gqlField */
  cursor: string;
  /** @gqlField */
  item: T;
};

/** @gqlQueryField */
export function one(): Edge<UserConnection> {
  return null as any;
}

/** @gqlQueryField */
export function two(): ConnectionEdge<User> {
  return null as any;
}
