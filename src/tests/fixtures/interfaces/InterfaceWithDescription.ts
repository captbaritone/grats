/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
}

/**
 * An interface describing the common elements of all people types.
 *
 * @GQLInterface
 */
interface IPerson {
  /** @GQLField */
  name: string;
}

/** @GQLType */
class User implements IPerson {
  /** @GQLField */
  name: string;
}
