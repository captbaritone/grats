/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): Array<string> {
    return ["Hello world!"];
  }
}
