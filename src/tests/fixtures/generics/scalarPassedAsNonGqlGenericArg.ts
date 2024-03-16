/** @gqlType */
type Wrapper<T> = {
  /** @gqlField */
  value: string;
};

/** @gqlType */
type OtherType = {
  /** @gqlField */
  wrapper: Wrapper<string>;
};
