import IPerson from "../interfaces/IPerson";
import Query from "../Query";
import Group from "./Group";

/** @GQLType User */
export default class UserResolver implements IPerson {
  __typename = "User";
  /** @GQLField */
  name(): string {
    return "Alice";
  }
  /** @GQLField */
  groups(): Group[] {
    return [new Group()];
  }
}

/** @GQLExtendType */
export function allUsers(_: Query): UserResolver[] {
  return [new UserResolver(), new UserResolver()];
}
