// trim-start
/** @gqlType */
type GqlError = {
  __typename: "GqlError";
  /** @gqlField */
  message: string;
};

// trim-end
/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlUnion */
type Result<T> = T | GqlError;
