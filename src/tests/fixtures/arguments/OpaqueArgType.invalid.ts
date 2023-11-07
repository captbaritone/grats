type SomeType = any;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: SomeType): string {
    return "Hello world!";
  }
}
