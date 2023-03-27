/** @gqlType */
class Query {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum = "VALID" | number;
