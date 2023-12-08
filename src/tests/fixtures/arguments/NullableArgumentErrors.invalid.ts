/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello1({ greeting }: { greeting: string | null }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello2({ greeting }: { greeting: string | void }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello3({ greeting }: { greeting: string | undefined }): string {
    return "Hello world!";
  }
  // TODO: This should be an error, but it's not.
  /** @gqlField */
  hello5({ greeting }: { greeting?: string | undefined }): string {
    return "Hello world!";
  }
}
