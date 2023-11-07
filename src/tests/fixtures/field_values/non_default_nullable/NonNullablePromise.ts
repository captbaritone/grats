// { "nullableByDefault": false }
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): Promise<string> {
    return Promise.resolve("Hello world!");
  }
}
