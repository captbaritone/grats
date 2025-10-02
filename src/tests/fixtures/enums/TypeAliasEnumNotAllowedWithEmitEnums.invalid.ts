// {"EXPERIMENTAL__emitEnums": "enums.ts"}

/** @gqlEnum */
export type Status = "PENDING" | "COMPLETE" | "CANCELLED";

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function status(_: Query): Status {
  return "PENDING";
}