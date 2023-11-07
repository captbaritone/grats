/** @gqlType */
class SomeType {
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
  friends(): User[] {
    return [new User()];
  }

  other: T;
}
