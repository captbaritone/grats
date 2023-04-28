/**
 * @gqlType
 * @gqlImplements HasName
 */
export default interface User {
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
