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

/** @gqlType */
class User implements IPerson {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;

  /** @gqlField */
  greeting(): string {
    return `Hello ${this.name}!`;
  }
}
