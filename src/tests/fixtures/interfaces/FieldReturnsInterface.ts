/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me(): IPerson {
    return new User();
  }
}

/** @gqlInterface Person */
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
