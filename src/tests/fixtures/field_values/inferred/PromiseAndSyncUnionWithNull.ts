/** @gqlType */
export default class Query {
  /** @gqlField */
  hello() {
    return foo();
  }
}

function foo(): Promise<string | null> | string | null {
  return "Hello world!";
}
