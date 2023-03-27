/** @gqlType */
export default class Query {
  /** @gqlField */
  async hello(): Promise<string> {
    return "Hello world!";
  }
}
