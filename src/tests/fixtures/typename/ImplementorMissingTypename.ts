/** @GQLType */
export class User implements IPerson {
  /** @GQLField */
  name: string = "Alice";
}

/** @GQLInterface */
export interface IPerson {
  /** @GQLField */
  name: string;
}
