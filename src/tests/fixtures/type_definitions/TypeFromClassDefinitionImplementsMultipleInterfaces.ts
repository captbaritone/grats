/** @gqlInterface Node */
interface GqlNode {
  /** @gqlField */
  id: string;
}

/** @gqlInterface */
interface Person {
  /** @gqlField */
  hello: string;
}

/** @gqlType */
export default class User implements Person, GqlNode {
  readonly __typename = "User" as const;
  /** @gqlField */
  hello: string;

  /** @gqlField */
  id: string;
}
