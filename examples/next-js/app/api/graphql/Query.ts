/**
 * Note: This file is split out from `route.ts` because Next has
 * special expectations about the meaning of exports from `route.ts`.
 */

import IPerson from "./interfaces/IPerson";
import User from "./models/User";

/** @gqlType */
export type Query = unknown;

/** @gqlField */
export function me(_: Query): User {
  return new User();
}
/** @gqlField */
export function person(_: Query): IPerson {
  return new User();
}
