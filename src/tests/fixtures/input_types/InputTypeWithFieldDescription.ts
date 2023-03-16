/** @GQLType */
export default class Query {
  /** @GQLField */
  hello: string;
}

/** @GQLInput */
type MyInputType = {
  /** Sweet field! */
  someField: string;
};
