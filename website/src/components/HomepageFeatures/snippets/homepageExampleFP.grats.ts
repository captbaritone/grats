/**
 * A user in our kick-ass system!
 * @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlField */
export function greet(user: User, greeting: string): string {
  return `${greeting}, ${user.name}`;
}
