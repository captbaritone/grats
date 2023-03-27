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

/** @gqlInterface */
interface Actor {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements Person, Actor {
  __typename = "User";
  /** @gqlField */
  name: string;
}
