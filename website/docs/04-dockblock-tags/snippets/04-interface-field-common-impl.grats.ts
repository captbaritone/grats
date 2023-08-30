/** @gqlInterface */
interface Greetable {
  /** @gqlField */
  name: string;
}

// highlight-start
/** @gqlField */
export function greeting(thing: Greetable): string {
  return `Hello ${thing.name}!`;
}
// highlight-end

// trim-start
/** @gqlType */
class User implements Greetable {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Pet implements Greetable {
  __typename: "Pet";
  /** @gqlField */
  name: string;
}
// trim-end
