/** @gqlType */
export interface User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static getUser(_: Query): User;
}

/** @gqlType */
type Query = unknown;
