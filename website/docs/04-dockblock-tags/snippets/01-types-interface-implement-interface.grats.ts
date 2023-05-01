/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/**
 * @gqlType
 * @gqlImplements Person
 */
interface User {
  __typename: "User";
  /** @gqlField */
  name: string;
}
