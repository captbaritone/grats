/** @gqlType */
class Query {
  /** @gqlField */
  someField(args: { input: MyInputType }): string;
}

/** @gqlInput */
type MyInputType = {
  someField: Query;
};
