/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlInterface */
interface IPerson {
  /**
   * The person's name
   * @gqlField
   */
  name: string;
}

/** @gqlType */
class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}
