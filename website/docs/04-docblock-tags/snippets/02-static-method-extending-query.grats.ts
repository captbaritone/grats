/** @gqlType */
type Query = unknown;

/** @gqlType */
export class User {
  constructor(
    /** @gqlField */
    public name: string,
  ) {}

  // highlight-start
  /** @gqlField */
  static getUser(_: Query): User {
    return new User("Elizabeth");
  }
  // highlight-end
}
