/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): Array<string | null> {
    return ["Hello world!", null];
  }
}
