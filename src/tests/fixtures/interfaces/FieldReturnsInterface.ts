/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): IPerson {
    return new User();
  }
}

/** @GQLInterface Person */
interface IPerson {
  /** @GQLField */
  name: string;
}

/** @GQLType */
class User implements IPerson {
  __typename = "User";
  /** @GQLField */
  name: string;
}
