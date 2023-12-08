/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello1({ greeting }: { greeting?: string | null }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello2({
    greeting,
  }: {
    greeting?: string | undefined | void | undefined;
  }): string {
    return "Hello world!";
  }
}
