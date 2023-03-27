/** @gqlType */
export class User {
  /** @gqlField */
  name: string = "Alice";
}

/** @gqlType */
export class Group {
  /** @gqlField */
  name: string = "Alice Fan Club";
}

/** @gqlUnion */
export type MyUnion = User | Group;
