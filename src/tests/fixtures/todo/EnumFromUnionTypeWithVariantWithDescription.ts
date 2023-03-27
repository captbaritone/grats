/** @gqlType */
export default class Query {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum =
  /** VALIDATED! */
  | "VALID"
  /** INVALIDATED! */
  | "INVALID";
