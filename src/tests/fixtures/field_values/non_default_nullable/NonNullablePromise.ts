// { "nullableByDefault": false }
/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): Promise<string> {
    return Promise.resolve("Hello world!");
  }
}
