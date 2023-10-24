/** @gqlField */
export function greeting(thing: IThing): string {
  return `Hello ${thing.name}!`;
}

/** @gqlInterface */
interface IThing {
  name: string;
  // Should have greeting added
}

/**
 * @gqlInterface
 */
interface IPerson extends IThing {
  name: string;
  // Should have greeting added
}

/** @gqlType */
class User implements IPerson, IThing {
  __typename: "User";
  name: string;
  // Should have greeting added
}

/** @gqlType */
class Admin implements IPerson, IThing {
  __typename: "Admin";
  name: string;
  // Should have greeting added
}
