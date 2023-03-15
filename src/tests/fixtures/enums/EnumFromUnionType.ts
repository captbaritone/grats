/** @GQLType */
class Query {
  /** @GQLField */
  hello: MyEnum;
}

/** @GQLEnum */
type MyEnum = "VALID" | "INVALID";
