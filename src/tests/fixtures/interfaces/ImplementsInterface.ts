/** @gqlType */
export default class SomeType {
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
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}
