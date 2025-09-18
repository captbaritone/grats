/** @gqlType */
export class User implements IPerson {
  __typename: "Group";
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
