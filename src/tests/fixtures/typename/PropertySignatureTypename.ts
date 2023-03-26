/** @GQLType */
export class User implements IPerson {
  __typename: "User";
  /** @GQLField */
  name: string;
}

/** @GQLInterface */
export interface IPerson {
  /** @GQLField */
  name: string;
}
