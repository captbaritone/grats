// { "nullableByDefault": false }
/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): Promise<string> {
    return Promise.resolve("Hello world!");
  }
}
