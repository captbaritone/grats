type SomeType = any;

/** @GQLType */
export default class Query {
  /** @GQLField */
  hello({ greeting }: SomeType): string {
    return "Hello world!";
  }
}
