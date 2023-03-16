/** @GQLType */
class Query {
  /** @GQLField */
  hello: string;
}

/** @GQLEnum */
enum Enum {
  /** Valid enum value. */
  VALID = "VALID",
  /** Invalid enum value. */
  INVALID = "INVALID",
}
