/** @gqlType User */
class UserResolver {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class SomeType {
  /** @gqlField */
  me: UserResolver;
}
