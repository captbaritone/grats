import IPerson from "./interfaces/IPerson";
import User from "./models/User";

/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): User {
    return new User();
  }
  /** @gqlField */
  person(): IPerson {
    return new User();
  }
}

/** @gqlOperationType */
export function query(): Query {
  return new Query();
}
