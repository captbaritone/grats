-----------------
INPUT
----------------- 
/** @gqlType User */
export class UserModel {
  __typename = "UserModel" as const;
  /** @gqlField */
  name: string = "Alice";
}

-----------------
OUTPUT
-----------------
-- Error Report --
src/tests/fixtures/typename/PropertyTypenameDoesNotMatchDeclaredName.invalid.ts:3:16 - error: Expected `__typename` property initializer to be `"User"`, found `"UserModel"`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

3   __typename = "UserModel" as const;
                 ~~~~~~~~~~~


-- Code Action: "Create Grats-compatible `__typename` property" (fix-typename-property) --
- Original
+ Fixed

@@ -2,3 +2,3 @@
  export class UserModel {
-   __typename = "UserModel" as const;
+   __typename = "User" as const;
    /** @gqlField */

-- Applied Fixes --
  * Applied fix "Create Grats-compatible `__typename` property" in grats/src/tests/fixtures/typename/PropertyTypenameDoesNotMatchDeclaredName.invalid.ts

-- Fixed Text --
/** @gqlType User */
export class UserModel {
  __typename = "User" as const;
  /** @gqlField */
  name: string = "Alice";
}
