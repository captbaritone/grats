// @ts-nocheck

/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): string {
    return "Hello world!";
  }
  /** @GQLField */
  hello(): Array<string> {
    return ["Hello world!"];
  }
}
