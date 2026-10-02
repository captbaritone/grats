// An error in a generic type is reported once, rather than once for each type
// materialized from it.
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
type Page<T> = {
  /** @gqlField */
  items: T[];
  /** @gqlField */
  bad: Undefined;
};

/** @gqlQueryField */
export function users(): Page<User> {
  return null as any;
}

/** @gqlQueryField */
export function posts(): Page<Post> {
  return null as any;
}
