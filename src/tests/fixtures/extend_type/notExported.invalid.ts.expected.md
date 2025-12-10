-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
function greeting(_: Query): string {
  return `Hello World`;
}

-----------------
OUTPUT
-----------------
-- Error Report --
src/tests/fixtures/extend_type/notExported.invalid.ts:7:10 - error: Expected a `@gqlField` function to be a named export. Grats needs to import resolver functions into its generated schema module, so the resolver function must be a named export.

7 function greeting(_: Query): string {
           ~~~~~~~~


-- Code Action: "Add export keyword to function with @gqlField" (add-export-keyword-to-function) --
- Original
+ Fixed

@@ -6,3 +6,3 @@
  /** @gqlField */
- function greeting(_: Query): string {
+ export function greeting(_: Query): string {
    return `Hello World`;

-- Applied Fixes --
  * Applied fix "Add export keyword to function with @gqlField" in grats/src/tests/fixtures/extend_type/notExported.invalid.ts

-- Fixed Text --
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(_: Query): string {
  return `Hello World`;
}
