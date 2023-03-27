/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlInterface */
interface Person<T> {
  /** @gqlField */
  name: string;

  other: T;
}

/** @gqlType */
class User implements Person<string> {
  __typename = "User";
  /** @gqlField */
  name: string;

  other: string;
}
