import IPerson from "./interfaces/IPerson";
import User from "./models/User";

/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
  /** @GQLField */
  person(): IPerson {
    return new User();
  }
}
