## input

```ts title="enums/ExportedEnumsWithEmitEnumsConfig.invalid.ts"
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
```

## Output

```
src/tests/fixtures/enums/ExportedEnumsWithEmitEnumsConfig.invalid.ts:11:1 - error: Type alias enums are not supported when `tsClientEnums` is configured. Use `enum` declarations instead. For example: `export enum Status { PENDING = "pending" }`.

11 export type Status = "PENDING" | "COMPLETE" | "CANCELLED";
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```