// { "nullableByDefault": false }
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): Promise<string | void> {
    return Promise.resolve("Hello world!");
  }
}
