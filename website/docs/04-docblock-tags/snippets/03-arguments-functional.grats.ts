// trim-start
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// trim-end
/** @gqlField */
export function greeting(user: User, salutation: string): string {
  return `${salutation} ${user.name}`;
}
