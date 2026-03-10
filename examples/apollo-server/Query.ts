import IPerson from "./interfaces/IPerson.js";
import User from "./models/User.js";

/** @gqlQueryField */
export function person(): IPerson {
  return new User();
}
