/** @GQLScalar */
type MyString = string;

/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(): MyString {
    return "Hello world!";
  }
}
