/** @GQLType */
export class User {
  /** @GQLField */
  name: string = "Alice";
}

/** @GQLType */
export class Group {
  /** @GQLField */
  name: string = "Alice Fan Club";
}

/** @GQLUnion */
export type MyUnion = User | Group;
