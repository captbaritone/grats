/** @GQLType */
class Query {
  /** @GQLField */
  async me(): Promise<User> {
    return new User();
  }
}

/** @GQLType */
class User {
  /** @GQLField */
  name(): string {
    return "Alice";
  }
  /** @GQLField */
  friends(): User[] {
    return [new User()];
  }
}
