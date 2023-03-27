/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): ReadonlyArray<string> {
    return ["Hello world!"];
  }
}
