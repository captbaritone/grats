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
