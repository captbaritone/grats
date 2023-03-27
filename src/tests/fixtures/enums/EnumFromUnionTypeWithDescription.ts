/** @gqlType */
class Query {
  /** @gqlField */
  hello: MyEnum;
}

/**
 * Hello!
 * @gqlEnum
 */
type MyEnum = "VALID" | "INVALID";
