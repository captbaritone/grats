/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/**
 * @gqlInterface
 * @gqlImplements Person
 */
interface User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  username: string;
}
