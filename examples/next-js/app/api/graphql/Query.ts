/**
 * Note: This file is split out from `route.ts` because Next has
 * special expectations about the meaning of exports from `route.ts`.
 */

import IPerson from "./interfaces/IPerson";
import User from "./models/User";

/** @gqlQueryField */
export function me(): User {
  return new User();
}
/** @gqlQueryField */
export function person(): IPerson {
  return new User();
}
