/** @gqlType */
export default class Query {
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
  __typename = "User";
  /** @gqlField */
  name?: string;
}
