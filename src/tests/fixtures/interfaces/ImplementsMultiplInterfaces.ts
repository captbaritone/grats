/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
}

/** @GQLInterface */
interface Person {
  /** @GQLField */
  name: string;
}

/** @GQLInterface */
interface Actor {
  /** @GQLField */
  name: string;
}

/** @GQLType */
class User implements Person, Actor {
  /** @GQLField */
  name: string;
}
