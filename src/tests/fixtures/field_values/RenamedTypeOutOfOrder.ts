/** @gqlType */
class SomeType {
  /** @gqlField */
  me: UserResolver;
}

/** @gqlType User */
class UserResolver {
  /** @gqlField */
  name: string;
}
