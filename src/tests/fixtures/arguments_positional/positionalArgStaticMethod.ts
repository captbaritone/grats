import { ID } from "../../../Types";

/** @gqlType */
export class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  static fetchUser(_: Query, id: ID): User {
    return new User();
  }
}

/** @gqlType */
type Query = unknown;
