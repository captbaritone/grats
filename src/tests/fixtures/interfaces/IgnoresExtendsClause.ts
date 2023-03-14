/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
}

class Person {
  name: string;
}

/** @GQLInterface */
interface Actor {
  /** @GQLField */
  name: string;
}

/** @GQLType */
class User extends Person implements Actor {
  /** @GQLField */
  name: string;
}
