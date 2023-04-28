/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/**
 * @gqlType
 * @gqlImplements Person
 */
type Visitor = {
  __typename: "Visitor";
  /** @gqlField */
  name: string;
};
