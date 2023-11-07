/** @gqlType */
export default class SomeType {
  /**
   * @gqlField
   * @killsParentOnException
   */
  hello(): string {
    return "Hello world!";
  }
}
