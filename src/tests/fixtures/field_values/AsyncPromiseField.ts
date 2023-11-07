/** @gqlType */
export default class SomeType {
  /** @gqlField */
  async hello(): Promise<string> {
    return "Hello world!";
  }
}
