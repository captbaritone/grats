/** @gqlType */
class Query {
  /** @gqlField */
  async me(): Promise<User<string>> {
    return new User();
  }
}

/** @gqlType */
class User<T> {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  friends(): User<string>[] {
    return [new User()];
  }

  other: T;
}
