/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlInput */
type MyInputType = {
  /** Sweet field! */
  someField: string;
};
