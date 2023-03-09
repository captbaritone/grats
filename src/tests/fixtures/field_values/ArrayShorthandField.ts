/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): string[] {
    return ["Hello world!"];
  }
}
