/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
}

/** @GQLInterface */
interface IPerson {
  /**
   * The person's name
   * @GQLField
   */
  name: string;
}

/** @GQLType */
class User implements IPerson {
  __typename = "User";
  /** @GQLField */
  name: string;
}
