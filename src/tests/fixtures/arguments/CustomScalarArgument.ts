/** @GQLScalar */
type MyString = string;

/** @GQLType */
export default class Query {
  /** @GQLField */
  hello({ greeting }: { greeting: MyString }): string {
    return "Hello world!";
  }
}
