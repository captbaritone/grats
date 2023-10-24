/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/**
 * @gqlType
 * @gqlImplements Person
 */
export interface User {
  __typename: "User";

  /** @gqlField */
  name: string;
}
