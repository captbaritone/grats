/** @gqlType */
export default class Query {
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
  __typename = "User";
  /**
   * The user's name
   * @gqlField
   */
  name: string;
}
