/** @gqlScalar */
type MyString = string & {};

/** @gqlType */
export default class Query {
  /** @gqlField */
  hello({ greeting }: { greeting: MyString }): string {
    return "Hello world!";
  }
}
