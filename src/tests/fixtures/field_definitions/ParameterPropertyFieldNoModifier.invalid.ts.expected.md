## input

```ts title="field_definitions/ParameterPropertyFieldNoModifier.invalid.ts"
/** @gqlType */
export default class SomeType {
  constructor(
    /** @gqlField */
    hello: string,
  ) {
    console.log(hello);
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/ParameterPropertyFieldNoModifier.invalid.ts:5:5 - error: Expected `@gqlField` constructor parameter to be a parameter property. This requires a modifier such as `public` or `readonly` before the parameter name.

Learn more: https://grats.capt.dev/docs/docblock-tags/fields#class-based-fields

5     hello: string,
      ~~~~~~~~~~~~~
```

#### Code Action: "Add 'public' modifier" (add-public-modifier)

```diff
- Original
+ Fixed

@@ -4,3 +4,3 @@
      /** @gqlField */
-     hello: string,
+     public hello: string,
    ) {
```

#### Applied Fixes

```text
* Applied fix "Add 'public' modifier" in grats/src/tests/fixtures/field_definitions/ParameterPropertyFieldNoModifier.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlType */
export default class SomeType {
  constructor(
    /** @gqlField */
    public hello: string,
  ) {
    console.log(hello);
  }
}
```