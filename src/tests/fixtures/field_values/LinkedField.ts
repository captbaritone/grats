/** @gqlType */
class Query {
  /** @gqlField */
  async me(): Promise<User> {
    return new User();
  }
}

/** @gqlType */
class User {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  friends(): User[] {
    return [new User()];
  }
}
