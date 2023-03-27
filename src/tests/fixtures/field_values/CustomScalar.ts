/** @gqlScalar */
type MyString = string;

/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): MyString {
    return "Hello world!";
  }
}
