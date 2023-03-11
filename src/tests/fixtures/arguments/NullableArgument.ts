/** @GQLType */
export default class Query {
  /** @GQLField */
  hello1({ greeting }: { greeting: string | null }): string {
    return "Hello world!";
  }
  /** @GQLField */
  hello2({ greeting }: { greeting?: string }): string {
    return "Hello world!";
  }
  /** @GQLField */
  hello3({ greeting }: { greeting: string | void }): string {
    return "Hello world!";
  }
  /** @GQLField */
  hello4({ greeting }: { greeting: string | undefined }): string {
    return "Hello world!";
  }
  /** @GQLField */
  hello5({
    greeting,
  }: {
    greeting?: string | undefined | void | undefined;
  }): string {
    return "Hello world!";
  }
}
