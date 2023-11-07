/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): (string | null)[] {
    return ["Hello world!"];
  }
}
