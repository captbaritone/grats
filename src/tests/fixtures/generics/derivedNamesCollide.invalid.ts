// `Pair<AB, C>` and `Pair<A, BC>` would both be named `ABCPair`.
/** @gqlType */
type A = {
  /** @gqlField */
  a: string;
};
/** @gqlType */
type AB = {
  /** @gqlField */
  ab: string;
};
/** @gqlType */
type BC = {
  /** @gqlField */
  bc: string;
};
/** @gqlType */
type C = {
  /** @gqlField */
  c: string;
};

/** @gqlType */
type Pair<X, Y> = {
  /** @gqlField */
  first: X;
  /** @gqlField */
  second: Y;
};

/** @gqlQueryField */
export function one(): Pair<AB, C> {
  return null as any;
}

/** @gqlQueryField */
export function two(): Pair<A, BC> {
  return null as any;
}
