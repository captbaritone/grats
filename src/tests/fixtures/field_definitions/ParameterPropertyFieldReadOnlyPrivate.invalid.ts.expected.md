-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  constructor(
    /**
     * Greet the world!
     * @gqlField
     */
    private readonly hello: string,
  ) {}
}

-----------------
OUTPUT
-----------------
-- Error Report --
src/tests/fixtures/field_definitions/ParameterPropertyFieldReadOnlyPrivate.invalid.ts:8:5 - error: Expected `@gqlField` parameter property to be public. Valid modifiers for `@gqlField` parameter properties are  `public` and `readonly`.

Learn more: https://grats.capt.dev/docs/docblock-tags/fields#class-based-fields

8     private readonly hello: string,
      ~~~~~~~


-- Code Action: "Make parameter property public" (make-parameter-property-public) --
- Original
+ Fixed

@@ -7,3 +7,3 @@
       */
-     private readonly hello: string,
+     public readonly hello: string,
    ) {}

-- Applied Fixes --
  * Applied fix "Make parameter property public" in grats/src/tests/fixtures/field_definitions/ParameterPropertyFieldReadOnlyPrivate.invalid.ts

-- Fixed Text --
/** @gqlType */
export default class SomeType {
  constructor(
    /**
     * Greet the world!
     * @gqlField
     */
    public readonly hello: string,
  ) {}
}
