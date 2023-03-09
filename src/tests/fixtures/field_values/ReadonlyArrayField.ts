/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): ReadonlyArray<string> {
    return ["Hello world!"];
  }
}
