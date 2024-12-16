import IPerson from "./interfaces/IPerson";
import User from "./models/User";

// NOTE: Yoga does not support providing a `rootValue` to the executor. This
// means that we cannot use a concrete value such as a class or an object
// literal for Query or Mutation.
//
// Instead we use an empty type typed as `unknown`.

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
