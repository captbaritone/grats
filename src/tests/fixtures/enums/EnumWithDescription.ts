/** @gqlType */
class Query {
  /** @gqlField */
  hello: string;
}

/**
 * World's best enum.
 *
 * @gqlEnum
 */
enum Enum {
  VALID = "VALID",
  INVALID = "INVALID",
}
