import IPerson from "../interfaces/IPerson";
import Group from "./Group";

/** @gqlType User */
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
  static me(): User {
    return new User();
  }
  /** @gqlQueryField */
  static allUsers(): User[] {
    return [new User(), new User()];
  }
}
