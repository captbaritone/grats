/** @gqlScalar */
type MyString = string;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: MyString }): string {
    return "Hello world!";
  }
}
