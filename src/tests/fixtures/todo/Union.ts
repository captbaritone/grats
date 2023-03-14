/** @GQLType */
class User {
  /** @GQLField */
  name(): string {
    return "Alice";
  }
}

/** @GQLType */
class Group {
  /** @GQLField */
  name(): string {
    return "Fan Club";
  }
}

/** @GQLUnion */
type MyUnion = User | Group;
