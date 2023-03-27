/** @gqlType */
class Query {
  /** @gqlField */
  hello: string;
}

/** @gqlType */
class MyType {
  /** @gqlField */
  someField(): MyInputType;
}

/** @gqlInput */
type MyInputType = {
  someField: MyType;
};
