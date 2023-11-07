/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: { foo: string; bar: string } }): string {
    return "Hello world!";
  }
}
