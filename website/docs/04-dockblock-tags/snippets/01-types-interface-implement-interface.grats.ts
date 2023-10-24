/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
// highlight-start
export interface User extends Person {
  // highlight-end
  __typename: "User";
  /** @gqlField */
  name: string;
}
