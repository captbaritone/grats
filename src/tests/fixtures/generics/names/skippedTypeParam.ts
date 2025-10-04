/** @gqlType */
type Edge<From, To> = {
  /** @gqlField */
  node: To;
};

/** @gqlType */
type A = {
  /** @gqlField */
  a: string;
};

/** @gqlType */
type B = {
  /** @gqlField */
  b: string;
};

/** @gqlQueryField */
export function connection(): Edge<A, B> {
  return {
    node: {
      b: "b",
    },
  };
}
