-----------------
INPUT
----------------- 
// {"tsClientEnums": "enums.ts"}

/** @gqlEnum */
export type Status = "PENDING" | "COMPLETE" | "CANCELLED";

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function status(_: Query): Status {
  return "PENDING";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/enums/TypeAliasEnumNotAllowedWithEmitEnums.invalid.ts:4:1 - error: Type alias enums are not supported when `tsClientEnums` is configured. Use `enum` declarations instead. For example: `export enum Status { PENDING = "pending" }`.

4 export type Status = "PENDING" | "COMPLETE" | "CANCELLED";
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
