/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello1({ greeting }: { greeting: string | null }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello2({ greeting }: { greeting?: string | null }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello3({ greeting }: { greeting: string | void }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello4({ greeting }: { greeting: string | undefined }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello5({
    greeting,
  }: {
    greeting?: string | undefined | void | undefined;
  }): string {
    return "Hello world!";
  }
}
