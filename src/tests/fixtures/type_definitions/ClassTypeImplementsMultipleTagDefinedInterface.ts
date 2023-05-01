/**
 * @gqlType
 * @gqlImplements Person
 * @gqlImplements Member
 */
export default class User {
  __typename: "User";
  /** @gqlField */
  id: string;
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

/**
 * @gqlInterface
 */
interface Member {
  /** @gqlField */
  id: string;
}
