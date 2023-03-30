/** @gqlType */
export default class Query {
  /**
   * @gqlField
   * @killsParentOnException
   */
  hello(): string | null {
    return "Hello world!";
  }
}
