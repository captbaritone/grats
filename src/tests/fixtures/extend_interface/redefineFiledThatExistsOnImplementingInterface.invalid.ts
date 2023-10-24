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

/** @gqlInterface */
interface User extends IPerson {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;

  /** @gqlField */
  greeting(): string;
}
