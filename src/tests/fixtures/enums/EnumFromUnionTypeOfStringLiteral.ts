/** @gqlScalar */
type MyScalar = "SCALAR" & {};

/** @gqlScalar */
type MyString = string & {};

/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(): MyString {
    return "Hello world!";
  }

  /** @gqlField */
  bye(): MyScalar {
    return "SCALAR";
  }
}
