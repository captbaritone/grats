/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): string | boolean {
    return "Hello world!";
  }
}
