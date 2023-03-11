/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
}

/** @GQLInterface */
interface Person<T> {
  /** @GQLField */
  name: string;

  other: T;
}

/** @GQLType */
class User implements Person<string> {
  /** @GQLField */
  name: string;

  other: string;
}
