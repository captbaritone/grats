-----------------
INPUT
----------------- 
/** @gqlType */
type Query = unknown;

/** @gqlQueryField */
export function greeting(_: Query): string {
  return "Hello world";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/top_level_fields/queryFieldWithFirstArgParentType.invalid.ts:5:29 - error: The type of Query.greeting(_:) must be Input Type but got: Query!.

5 export function greeting(_: Query): string {
                              ~~~~~
