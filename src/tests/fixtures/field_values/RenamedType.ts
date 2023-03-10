/** @GQLType User */
class UserResolver {
  /** @GQLField */
  name: string;
}

/** @GQLType */
class Query {
  /** @GQLField */
  me: UserResolver;
}
