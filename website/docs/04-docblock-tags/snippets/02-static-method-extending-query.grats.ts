/** @gqlType */
export class User {
  constructor(
    /** @gqlField */
    public name: string,
  ) {}

  // highlight-start
  /** @gqlQueryField */
  static me(): User {
    return new User("Elizabeth");
  }
  // highlight-end
}
