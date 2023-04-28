/**
 * @gqlType
 * @gqlImplements Person
 */
export default class User {
  __typename: "User";
  /** @gqlField */
  name(): string {
    return "Samantha";
  }
}

/**
 * @gqlInterface
 */
interface Person {
  /** @gqlField */
  name(): string;
}
