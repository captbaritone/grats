/** @gqlType */
export default class SomeType {
  /**
   * Greet the world!
   * @gqlField
   */
  hello(): string {
    return "Hello world!";
  }
}
