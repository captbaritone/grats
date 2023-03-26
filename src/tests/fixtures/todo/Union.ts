/** @GQLType */
class User {
  __typename = "User";
  /** @GQLField */
  name(): string {
    return "Alice";
  }
}

/** @GQLType */
class Group {
  __typename = "Group";
  /** @GQLField */
  name(): string {
    return "Fan Club";
  }
}

/** @GQLUnion */
type MyUnion = User | Group;
