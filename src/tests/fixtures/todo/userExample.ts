/** @gqlType */
type SomeType = {};

/** @gqlField */
export function me(_: SomeType): User {
  return { firstName: "John", lastName: "Doe" };
}

/** @gqlType */
type User = {
  /** @gqlField */
  firstName: string;
  /** @gqlField */
  lastName: string;
};

/** @gqlField */
export function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}
