/** @gqlInterface */
interface Person {
  /** @gqlField */
  hello: string;
}

/**
 * @gqlType
 * @gqlImplements Person
 */
export default class User {
  readonly __typename = "User" as const;
  /** @gqlField */
  hello: string;
}
