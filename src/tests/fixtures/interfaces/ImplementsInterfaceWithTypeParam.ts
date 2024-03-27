/** @gqlType */
export default class SomeType {
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
  __typename = "User" as const;
  /** @gqlField */
  name: string;

  other: string;
}
