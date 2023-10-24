/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
export interface User extends Person {
  __typename: "User";

  /** @gqlField */
  name: string;
}
