// {"tsClientEnums": "enums.ts"}

/** @gqlEnum */
export enum Color {
  RED = "red",
  GREEN = "green",
  BLUE = "blue",
}

/** @gqlEnum */
export type Status = "PENDING" | "COMPLETE" | "CANCELLED";

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function favoriteColor(_: Query): Color {
  return Color.RED;
}

/** @gqlField */
export function status(_: Query): Status {
  return "PENDING";
}
