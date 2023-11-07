/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum =
  /** VALIDATED! */
  | "VALID"
  /** INVALIDATED! */
  | "INVALID";
