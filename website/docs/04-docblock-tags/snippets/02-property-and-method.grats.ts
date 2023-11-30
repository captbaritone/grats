/** @gqlType */
class User {
  /**
   * A description of some field.
   * @gqlField
   */
  someField: string;

  /** @gqlField */
  myField(): string {
    return "Hello World";
  }
}
