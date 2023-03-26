/** @GQLType */
export class User implements IPerson {
  __typename: string;
  /** @GQLField */
  name: string;
}

/** @GQLInterface */
export interface IPerson {
  /** @GQLField */
  name: string;
}
