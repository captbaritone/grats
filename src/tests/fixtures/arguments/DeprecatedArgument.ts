/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({
    greeting,
  }: {
    /** @deprecated Not used anymore */
    greeting?: string | null;
  }): string {
    return "Hello world!";
  }
}
