-----------------
INPUT
----------------- 
/** @GQLField */
function field() {}

-----------------
OUTPUT
-----------------
-- Error Report --
src/tests/fixtures/user_error/WrongCaseGqlTag.invalid.ts:1:6 - error: Incorrect casing for Grats tag `@GQLField`. Use `@gqlField` instead.

1 /** @GQLField */
       ~~~~~~~~


-- Code Action: "Change to @gqlField" (fix-grats-tag-casing) --
- Original
+ Fixed

@@ -1,2 +1,2 @@
- /** @GQLField */
+ /** @gqlField */
  function field() {}

-- Applied Fixes --
  * Applied fix "Change to @gqlField" in grats/src/tests/fixtures/user_error/WrongCaseGqlTag.invalid.ts

-- Fixed Text --
/** @gqlField */
function field() {}
