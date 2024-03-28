/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
}

/** @gqlField */
export function greeting(user: User, greeting: string): string {
  return `${greeting}, ${user.name}!`;
}
