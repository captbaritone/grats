/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(flag: true): string {
    return "Hello world!";
  }
}
