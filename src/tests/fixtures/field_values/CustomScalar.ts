/** @gqlScalar */
type MyString = string;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): MyString {
    return "Hello world!";
  }
}
