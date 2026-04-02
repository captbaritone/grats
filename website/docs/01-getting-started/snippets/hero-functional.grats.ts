/** @gqlQueryField */
export function me(): User {
  return { name: "Alice" };
}

/**
 * A user in our kick-ass system!
 * @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlField */
export function greeting(user: User, salutation: string): string {
  return `${salutation}, ${user.name}`;
}
