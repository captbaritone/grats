/** @gqlInterface */
interface Person {
  /** @gqlField */
  hello: string;
}

/** @gqlType */
export default class User implements Person {
  readonly __typename = "User";
  /** @gqlField */
  hello: string;
}
