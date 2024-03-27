/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): User {
    return new User();
  }
}

/**
 * An interface describing the common elements of all people types.
 *
 * @gqlInterface
 */
interface IPerson {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}
