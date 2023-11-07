/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): Array<string | null> {
    return ["Hello world!", null];
  }
}
