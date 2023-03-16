/** @GQLType */
class Query {
  /** @GQLField */
  hello: string;
}

/**
 * World's best enum.
 *
 * @GQLEnum
 */
enum Enum {
  VALID = "VALID",
  INVALID = "INVALID",
}
