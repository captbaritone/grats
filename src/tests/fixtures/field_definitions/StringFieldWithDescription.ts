/** @gqlType */
export default class Query {
  /**
   * Greet the world!
   * @gqlField
   */
  hello(): string {
    return "Hello world!";
  }
}
