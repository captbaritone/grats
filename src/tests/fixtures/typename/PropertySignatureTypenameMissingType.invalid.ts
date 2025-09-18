/** @gqlType */
export class User implements IPerson {
  __typename;
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
