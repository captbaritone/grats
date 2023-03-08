/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): Array<string> {
    return ["Hello world!"];
  }
}
