type SomeType = any;

/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting }: SomeType): string {
    return "Hello world!";
  }
}
