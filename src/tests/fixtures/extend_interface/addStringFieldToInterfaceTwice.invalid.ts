/** @gqlInterface */
interface IPerson {
  name: string;
  /** @gqlField */
  hello: string;
}

/** @gqlField */
export function greeting(person: IPerson): string {
  return `Hello ${person.name}!`;
}

/** @gqlField greeting */
export function alsoGreeting(person: IPerson): string {
  return `Hello ${person.name}!`;
}

/** @gqlType */
class User implements IPerson {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;
}

/** @gqlType */
class Admin implements IPerson {
  __typename: "Admin";
  name: string;
  /** @gqlField */
  hello: string;
}
