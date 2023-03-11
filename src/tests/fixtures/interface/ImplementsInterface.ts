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

/** @GQLType */
class User implements Person {
  /** @GQLField */
  name: string;
}
