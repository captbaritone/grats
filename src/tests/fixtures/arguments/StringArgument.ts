/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: string }): string {
    return "Hello world!";
  }
}
