/** @gqlType */
export class User implements IPerson {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
