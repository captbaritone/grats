/** @GQLType */
export default class Query {
  /** @GQLField */
  hello: MyEnum;
}

/** @GQLEnum */
type MyEnum =
  /** VALIDATED! */
  | "VALID"
  /** INVALIDATED! */
  | "INVALID";
