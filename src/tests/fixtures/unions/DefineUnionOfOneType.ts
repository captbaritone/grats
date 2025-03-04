/** @gqlType */
class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

/** @gqlUnion */
type Actor = User;
