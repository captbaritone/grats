/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum = "VALID" | "INVALID";
