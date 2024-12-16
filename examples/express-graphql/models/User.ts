import IPerson from "../interfaces/IPerson";
import Group from "./Group";

/** @gqlType User */
export default class UserResolver implements IPerson {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  groups(): Group[] {
    return [new Group()];
  }
  /** @gqlQueryField */
  static allUsers(): UserResolver[] {
    return [new UserResolver(), new UserResolver()];
  }

  /** @gqlQueryField */
  static me(): UserResolver {
    return new UserResolver();
  }
}
