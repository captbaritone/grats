/** @gqlType */
class User {
  /** @gqlField */
  name: string = "Alice";
}

/** @gqlType */
class Group {
  /** @gqlField */
  name: string = "Alice Fan Club";
}

/** @gqlUnion */
export type MyUnion = User | Group;
