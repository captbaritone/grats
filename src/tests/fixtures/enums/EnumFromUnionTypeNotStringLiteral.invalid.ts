/** @gqlType */
class Query {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum = "VALID" | 1;
