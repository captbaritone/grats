## input

```ts title="enumExport/index.ts"
// {"tsClientEnums": "enums.ts"}

/** @gqlEnum */
export enum Color {
  RED = "red",
  GREEN = "green",
  BLUE = "blue",
}

/** @gqlEnum */
export enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

/** @gqlQueryField */
export function favoriteColor(): Color {
  return Color.RED;
}

/** @gqlQueryField */
export function currentPriority(): Priority {
  return Priority.MEDIUM;
}

/** @gqlQueryField */
export function colorName(color: Color): string {
  switch (color) {
    case Color.RED:
      return "Red";
    case Color.GREEN:
      return "Green";
    case Color.BLUE:
      return "Blue";
    default:
      return "Unknown";
  }
}

export const query = /* GraphQL */ `
  query {
    favoriteColor
    currentPriority
    colorName(color: red)
  }
`;
```

## Output

```
{
  "data": {
    "favoriteColor": "red",
    "currentPriority": "medium",
    "colorName": "Red"
  }
}
```