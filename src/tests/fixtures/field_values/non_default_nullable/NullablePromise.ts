// { "nullableByDefault": false }
/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): Promise<string | void> {
    return Promise.resolve("Hello world!");
  }
}
