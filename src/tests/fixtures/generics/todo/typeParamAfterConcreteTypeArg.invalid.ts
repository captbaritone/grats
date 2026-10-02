// TODO: This should not be an error. `Wrapper` is only detected as generic if
// its first type reference which has type arguments passes a type parameter.
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
type Pair<A, B> = {
  /** @gqlField */
  first: A;
  /** @gqlField */
  second: B;
};

/** @gqlType */
type Wrapper<T> = {
  /** @gqlField */
  pair: Pair<User, T>;
};

/** @gqlQueryField */
export function wrapper(): Wrapper<Post> {
  return null as any;
}
