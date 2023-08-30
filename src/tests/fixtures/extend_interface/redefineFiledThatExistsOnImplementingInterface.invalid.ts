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

/**
 * @gqlInterface
 * @gqlImplements IPerson
 */
interface User {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;

  /** @gqlField */
  greeting(): string;
}
