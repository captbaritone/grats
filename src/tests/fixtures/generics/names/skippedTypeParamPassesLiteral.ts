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
export function connection(): Edge<
  // It's okay to pass a non-GQL type parameter here since `From` is not used in a
  // GraphQL position.
  {},
  B
> {
  return {
    node: {
      b: "b",
    },
  };
}
