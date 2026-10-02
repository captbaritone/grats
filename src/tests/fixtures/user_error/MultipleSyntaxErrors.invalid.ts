/** @gqlType */
class Foo {
  /** @gqlField */
  bar: Array<>;
  /** @gqlField */
  baz(...args?: string[]): string {
    return "";
  }
}
