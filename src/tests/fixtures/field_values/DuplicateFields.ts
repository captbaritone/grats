// @ts-nocheck

/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello(): Array<string> {
    return ["Hello world!"];
  }
}
