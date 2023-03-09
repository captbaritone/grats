/** @GQLType */
export default class Query {
  /** @GQLField */
  async hello(): Promise<string> {
    return "Hello world!";
  }
}
