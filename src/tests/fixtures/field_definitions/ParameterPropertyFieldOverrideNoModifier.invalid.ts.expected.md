# field_definitions/ParameterPropertyFieldOverrideNoModifier.invalid.ts

## Input

```ts title="field_definitions/ParameterPropertyFieldOverrideNoModifier.invalid.ts"
class Base {
  hello: string = "Hello";
}

/** @gqlType */
export default class SomeType extends Base {
  constructor(
    /** @gqlField */
    override hello: string,
  ) {
    super();
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/ParameterPropertyFieldOverrideNoModifier.invalid.ts:9:5 - error: Expected `@gqlField` constructor parameter to be a parameter property. This requires a modifier such as `public` or `readonly` before the parameter name.

Learn more: https://grats.capt.dev/docs/docblock-tags/fields#class-based-fields

9     override hello: string,
      ~~~~~~~~~~~~~~~~~~~~~~
```

#### Code Action: "Add 'public' modifier" (add-public-modifier-to-existing)

```diff
--- Original
+++ Fixed
@@ -8,3 +8,3 @@
     /** @gqlField */
-    override hello: string,
+    override public hello: string,
   ) {
```

#### Applied Fixes

```text
  * Applied fix "Add 'public' modifier" in grats/src/tests/fixtures/field_definitions/ParameterPropertyFieldOverrideNoModifier.invalid.ts
```

#### Fixed Text

```typescript
class Base {
  hello: string = "Hello";
}

/** @gqlType */
export default class SomeType extends Base {
  constructor(
    /** @gqlField */
    override public hello: string,
  ) {
    super();
  }
}
```