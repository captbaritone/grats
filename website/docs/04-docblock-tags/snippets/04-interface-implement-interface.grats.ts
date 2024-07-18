/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
// highlight-start
interface User extends Person {
  // highlight-end
  name: string;

  /** @gqlField */
  username: string;
}
