/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements Person {
  __typename = "User";
  /** @gqlField */
  name: string;
}
