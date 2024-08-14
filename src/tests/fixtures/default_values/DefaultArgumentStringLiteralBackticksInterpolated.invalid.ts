const CONSTANT = "constant";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = `hello ${CONSTANT}` }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
