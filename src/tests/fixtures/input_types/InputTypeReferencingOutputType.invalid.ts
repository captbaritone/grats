/** @GQLType */
class Query {
  /** @GQLField */
  someField(args: { input: MyInputType }): string;
}

/** @GQLInput */
type MyInputType = {
  someField: Query;
};
