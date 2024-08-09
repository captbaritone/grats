/**
 * @gqlInput
 * @oneOf
 */
export type UserBy = { email: string } | { username: string };

/** @gqlField */
export function getUser(_: Query, args: { by: UserBy }): User {
  // highlight-start
  switch (true) {
    case "email" in args.by:
      return User.fromEmail(args.by.email);
    case "username" in args.by:
      return User.fromUsername(args.by.username);
    default: {
      // This line will error if an unhandled option is added to the union
      const _exhaustive: never = args.by;
      throw new Error(`Unhandled case: ${JSON.stringify(args.by)}`);
    }
  }
  // highlight-end
}
// trim-start

/** @gqlType */
type Query = unknown;

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
