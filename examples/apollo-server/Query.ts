import IPerson from "./interfaces/IPerson";
import User from "./models/User";

/** @gqlQueryField */
export function person(): IPerson {
  return new User();
}
