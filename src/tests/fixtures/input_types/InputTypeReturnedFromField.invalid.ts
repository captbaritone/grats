/** @GQLType */
class Query {
  /** @GQLField */
  hello: string;
}

/** @GQLType */
class MyType {
  /** @GQLField */
  someField(): MyInputType;
}

/** @GQLInput */
type MyInputType = {
  someField: MyType;
};
