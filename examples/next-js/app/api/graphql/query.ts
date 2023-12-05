/**
 * Note: This file is split out from `route.ts` because Next has
 * special expectations about the meaning of exports from `route.ts`.
 */

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greetings(_: Query): string {
  return "This is the `greetings` field of the root `Query` type";
}
