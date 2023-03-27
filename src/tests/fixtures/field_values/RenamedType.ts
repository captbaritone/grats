/** @gqlType User */
class UserResolver {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Query {
  /** @gqlField */
  me: UserResolver;
}
