/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: MyEnum;
}

/**
 * Hello!
 * @gqlEnum
 */
type MyEnum = "VALID" | "INVALID";
