/** @GQLType */
class Query {
  /** @GQLField */
  me: UserResolver;
}

/** @GQLType User */
class UserResolver {
  /** @GQLField */
  name: string;
}
