/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

class Person {
  name: string;
}

/** @gqlInterface */
interface Actor {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User extends Person implements Actor {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}
