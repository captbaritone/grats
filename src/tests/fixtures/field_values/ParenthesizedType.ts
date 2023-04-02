/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): (string | null)[] {
    return ["Hello world!"];
  }
}
