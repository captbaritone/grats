import User from "./models/User";

/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
}
