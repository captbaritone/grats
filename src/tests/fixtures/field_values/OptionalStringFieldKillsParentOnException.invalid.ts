/** @gqlType */
export default class SomeType {
  /**
   * @gqlField
   * @killsParentOnException
   */
  hello(): string | null {
    return "Hello world!";
  }
}
