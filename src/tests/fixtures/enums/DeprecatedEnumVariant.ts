/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlEnum */
enum Enum {
  /**
   * Valid enum value.
   * @deprecated Use something else.
   */
  VALID = "VALID",
  /** Invalid enum value. */
  INVALID = "INVALID",
}
