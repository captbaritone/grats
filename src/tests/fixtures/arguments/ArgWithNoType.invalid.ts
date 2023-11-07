/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting }): string {
    return "Hello world!";
  }
}
