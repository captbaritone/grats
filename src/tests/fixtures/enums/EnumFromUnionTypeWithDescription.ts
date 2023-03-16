/** @GQLType */
class Query {
  /** @GQLField */
  hello: MyEnum;
}

/**
 * Hello!
 * @GQLEnum
 */
type MyEnum = "VALID" | "INVALID";
