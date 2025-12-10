## input

```ts title="field_definitions/ParameterPropertyFieldReadOnlyPrivate.invalid.ts"
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
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/ParameterPropertyFieldReadOnlyPrivate.invalid.ts:8:5 - error: Expected `@gqlField` parameter property to be public. Valid modifiers for `@gqlField` parameter properties are  `public` and `readonly`.

Learn more: https://grats.capt.dev/docs/docblock-tags/fields#class-based-fields

8     private readonly hello: string,
      ~~~~~~~
```

#### Code Action: "Make parameter property public" (make-parameter-property-public)

```diff
- Original
+ Fixed

@@ -7,3 +7,3 @@
       */
-     private readonly hello: string,
+     public readonly hello: string,
    ) {}
```

#### Applied Fixes

```text
* Applied fix "Make parameter property public" in grats/src/tests/fixtures/field_definitions/ParameterPropertyFieldReadOnlyPrivate.invalid.ts
```

#### Fixed Text

```typescript
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
```