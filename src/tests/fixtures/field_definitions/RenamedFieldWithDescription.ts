/** @gqlType */
class SomeType {
  /**
   * Number 1 greeting.
   *
   * @gqlField greeting
   */
  somePropertyField: string;

  /**
   * Number 1 salutation.
   *
   * @gqlField salutaion
   */
  someMethodField(): string {
    return "Hello world!";
  }
}
