import IPerson from "../interfaces/IPerson";
import { Query } from "../Query";
import Group from "./Group";

/** @gqlType User */
export default class UserResolver implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  groups(): Group[] {
    return [new Group()];
  }
}

/** @gqlField */
export function allUsers(_: Query): UserResolver[] {
  return [new UserResolver(), new UserResolver()];
}
