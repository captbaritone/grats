/** @GQLType */
export default class Query {
  /**
   * Greet the world!
   * @GQLField
   */
  hello(): string {
    return "Hello world!";
  }
}
