/** @gqlType */
class User {
  __typename = "User";
  /** @gqlField */
  name(): string {
    return "Alice";
  }
}

/** @gqlType */
class Group {
  __typename = "Group";
  /** @gqlField */
  name(): string {
    return "Fan Club";
  }
}

/** @gqlUnion */
type MyUnion = User | Group;
