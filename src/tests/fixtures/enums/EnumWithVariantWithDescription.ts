/** @gqlType */
class Query {
  /** @gqlField */
  hello: string;
}

/** @gqlEnum */
enum Enum {
  /** Valid enum value. */
  VALID = "VALID",
  /** Invalid enum value. */
  INVALID = "INVALID",
}
