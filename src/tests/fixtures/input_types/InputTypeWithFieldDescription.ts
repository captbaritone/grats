/** @gqlType */
export default class Query {
  /** @gqlField */
  hello: string;
}

/** @gqlInput */
type MyInputType = {
  /** Sweet field! */
  someField: string;
};
