/** @GQLType */
type Query = {};

/** @GQLField */
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

/** @GQLField */
export function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}
