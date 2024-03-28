/** @gqlType */
type Err = {
  __typename: "Err";
  /** @gqlField */
  message: string;
};

/** @gqlUnion */
type Result<T> = T | Err;

/** @gqlType */
export type Page = {
  __typename: "Page";
  /** @gqlField */
  name: string;
};

/** @gqlType */
export type SomeType = {
  /** @gqlField */
  pageResult: Result<Page>;
};
