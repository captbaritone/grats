/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): string | void {
    return "Hello world!";
  }
  /** @gqlField */
  goodbye(): string | null {
    return "Hello world!";
  }
  /** @gqlField */
  farewell(): string | null | void | undefined {
    return "Hello world!";
  }
  /** @gqlField */
  async adieu(): Promise<string | null | void> {
    return "Hello world!";
  }
}
