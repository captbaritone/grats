/** @gqlType */
export default class SomeType {
  /**
   * @gqlField
   * @deprecated Use something else.
   */
  hello(): string {
    return "Hello world!";
  }
}
