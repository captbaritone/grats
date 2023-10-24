/**
 * @gqlType
 * @gqlImplements Person
 */
export type User = {
  __typename: "User";
  /** @gqlField */
  name: string;
};

/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}
