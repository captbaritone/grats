/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
export class User implements Person {
  __typename: "User";
  /** @gqlField */
  name: string;
}
