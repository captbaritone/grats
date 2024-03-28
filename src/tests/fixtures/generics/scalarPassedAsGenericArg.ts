/** @gqlType */
type Wrapper<T> = {
  /** @gqlField */
  value: T;
};

/** @gqlType */
type OtherType = {
  /** @gqlField */
  wrapper: Wrapper<string>;
};
