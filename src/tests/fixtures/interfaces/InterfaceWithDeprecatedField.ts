/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlInterface */
interface IPerson {
  /** @gqlField
   * @deprecated Not used anymore
   */
  name?: string;
}

/** @gqlType */
class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name?: string;
}
