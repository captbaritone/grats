// An unresolvable type argument is reported without hiding that `Wrapper` is
// generic.
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
  pair: Pair<Undefined, T>;
};

/** @gqlQueryField */
export function wrapper(): Wrapper<Post> {
  return null as any;
}
