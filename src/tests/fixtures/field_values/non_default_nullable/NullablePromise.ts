// { "nullableByDefault": false }
/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): Promise<string | void> {
    return Promise.resolve("Hello world!");
  }
}
