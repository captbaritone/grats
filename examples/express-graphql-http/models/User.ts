import IPerson from "../interfaces/IPerson.js";
import Group from "./Group.js";

/** @gqlType */
export default class User implements IPerson {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  groups(): Group[] {
    return [new Group()];
  }
  /** @gqlQueryField */
  static allUsers(): User[] {
    return [new User(), new User()];
  }

  /** @gqlQueryField */
  static me(): User {
    return new User();
  }
}
