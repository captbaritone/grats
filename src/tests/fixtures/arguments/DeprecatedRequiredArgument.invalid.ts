/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({
    greeting,
  }: {
    /** @deprecated Not used anymore */
    greeting: string;
  }): string {
    return "Hello world!";
  }
}
