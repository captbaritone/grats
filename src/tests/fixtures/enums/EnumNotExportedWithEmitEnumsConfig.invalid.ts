// {"EXPERIMENTAL__emitEnums": "enums.ts"}

/** @gqlEnum */
enum Color {
  RED = "red",
  GREEN = "green",
  BLUE = "blue",
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function favoriteColor(_: Query): Color {
  return Color.RED;
}
