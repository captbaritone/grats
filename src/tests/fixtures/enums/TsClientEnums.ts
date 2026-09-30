// {"tsClientEnums": "enums.ts"}

/** @gqlEnum */
export enum Priority {
  LOW = "low",
  HIGH = "high",
}

/** @gqlEnum Colour */
export enum Color {
  RED = "red",
  GREEN = "green",
}

/** @gqlQueryField */
export function priority(colour: Color): Priority {
  return colour === Color.RED ? Priority.HIGH : Priority.LOW;
}
