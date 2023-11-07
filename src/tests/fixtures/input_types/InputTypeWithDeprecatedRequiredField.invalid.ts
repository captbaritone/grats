/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlInput */
type MyInputType = {
  /** Sweet field!
   * @deprecated Sweet, but stale
   */
  someField: string;
};
