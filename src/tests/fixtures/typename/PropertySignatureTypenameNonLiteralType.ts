/** @gqlType */
export class User implements IPerson {
  __typename: string;
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
