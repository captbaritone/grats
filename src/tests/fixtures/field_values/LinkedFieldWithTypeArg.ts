/** @GQLType */
class Query {
  /** @GQLField */
  async me(): Promise<User<string>> {
    return new User();
  }
}

/** @GQLType */
class User<T> {
  /** @GQLField */
  name(): string {
    return "Alice";
  }
  /** @GQLField */
  friends(): User[] {
    return [new User()];
  }

  other: T;
}
