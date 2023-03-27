/** @gqlType */
export default class Query {
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
  __typename = "User";
  /** @gqlField */
  name: string;
}
