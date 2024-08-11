type NotGraphql = any;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: NotGraphql }): string {
    return "Hello world!";
  }
}
