// { "nullableByDefault": false }
/** @gqlType */
export default class Query {
  /**
   * @gqlField
   * @killsParentOnException
   */
  hello(): string {
    return "Hello world!";
  }
}
