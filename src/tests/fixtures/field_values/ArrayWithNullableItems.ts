/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): Array<string | null> {
    return ["Hello world!", null];
  }
}
