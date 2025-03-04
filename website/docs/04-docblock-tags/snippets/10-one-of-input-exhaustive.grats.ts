/**
 * @gqlInput
 */
export type UserBy = { email: string } | { username: string };

/** @gqlQueryField */
export function getUser(by: UserBy): User {
  // highlight-start
  switch (true) {
    case "email" in by:
      return User.fromEmail(by.email);
    case "username" in by:
      return User.fromUsername(by.username);
    default: {
      // This line will error if an unhandled option is added to the union
      const _exhaustive: never = by;
      throw new Error(`Unhandled case: ${JSON.stringify(by)}`);
    }
  }
  // highlight-end
}
// trim-start

/** @gqlType */
class User {
  constructor(
    /** @gqlField */
    public email?: string,
    /** @gqlField */
    public username?: string,
  ) {}

  static fromEmail(email: string): User {
    return new User(email, undefined);
  }

  static fromUsername(username: string): User {
    return new User(undefined, username);
  }
}
// trim-end
