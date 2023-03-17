/** @GQLType */
class Query {
  /** @GQLField */
  hello: string;
}

/** @GQLEnum */
enum Enum {
  /**
   * Valid enum value.
   * @deprecated Use something else.
   */
  VALID = "VALID",
  /** Invalid enum value. */
  INVALID = "INVALID",
}
