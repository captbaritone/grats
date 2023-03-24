import Query from "../Query";
import Group from "./Group";

/** @GQLType User */
export default class UserResolver {
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
