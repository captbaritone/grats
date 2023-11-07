/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): ReadonlyArray<string> {
    return ["Hello world!"];
  }
}
