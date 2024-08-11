import { GqlInfo } from "../../../Types";

/** @gqlField */
export function greetz(_: Query, info: GqlInfo): string {
  return "Hello";
}

/** @gqlType */
type Query = unknown;
