/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): string | void {
    return "Hello world!";
  }
  /** @GQLField */
  goodbye(): string | null {
    return "Hello world!";
  }
  /** @GQLField */
  farewell(): string | null | void | undefined {
    return "Hello world!";
  }
  /** @GQLField */
  async adieu(): Promise<string | null | void> {
    return "Hello world!";
  }
}
