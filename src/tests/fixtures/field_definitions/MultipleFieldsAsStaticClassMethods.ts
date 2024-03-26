/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static getUser(_: Query): User {
    return new User();
  }

  /** @gqlField */
  static getUsers(_: Query): User[] {
    return [new User()];
  }
}

/** @gqlType */
type Query = unknown;
