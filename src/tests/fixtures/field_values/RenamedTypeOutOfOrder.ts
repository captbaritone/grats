/** @gqlType */
class Query {
  /** @gqlField */
  me: UserResolver;
}

/** @gqlType User */
class UserResolver {
  /** @gqlField */
  name: string;
}
