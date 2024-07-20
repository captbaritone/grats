/** @gqlInterface */
interface IPerson {
  name: string;
  /** @gqlField */
  hello: string;
}

/**
 * As defined on the interface
 * @killsParentOnException
 * @gqlField */
export function greeting(person: IPerson): string {
  return `Hello ${person.name}!`;
}

/** @gqlType */
class User implements IPerson {
  __typename: "User";
  name: string;
  /** @gqlField */
  hello: string;

  /**
   * As defined on the concrete type
   * @gqlField */
  greeting(): string {
    return `Hello ${this.name}!`;
  }
}
