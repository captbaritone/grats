import { Int } from "grats";

/** @gqlType */
export default class User {
  /** @gqlField */
  name(): string {
    return "Alice";
  }

  /** @gqlField */
  age(): Int {
    return 42;
  }

  /** @gqlQueryField */
  static me(): User {
    return new User();
  }

  /** @gqlQueryField */
  static allUsers(): User[] {
    return [new User(), new User()];
  }
}
