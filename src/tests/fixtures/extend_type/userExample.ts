/** @GQLType */
type Query = {};

/** @GQLExtendType */
export function me(_: Query): User {
  return { firstName: "John", lastName: "Doe" };
}

/** @GQLType */
type User = {
  /** @GQLField */
  firstName: string;
  /** @GQLField */
  lastName: string;
};

/** @GQLExtendType */
export function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}
