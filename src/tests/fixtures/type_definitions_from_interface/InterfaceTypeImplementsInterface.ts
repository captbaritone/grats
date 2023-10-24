/** @gqlType */
export default interface User extends HasName {
  __typename: "User";
  /** @gqlField */
  hello: string;

  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface HasName {
  /** @gqlField */
  name: string;
}
