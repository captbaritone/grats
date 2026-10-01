# custom_scalars/SpecifiedByOldSyntaxEscapesUrl.invalid.ts

## Input

```ts title="custom_scalars/SpecifiedByOldSyntaxEscapesUrl.invalid.ts"
/**
 * @gqlScalar
 * @specifiedBy https://example.com/"uuid"\spec
 */
export type UUID = string;
```

## Output

### Error Report

```text
src/tests/fixtures/custom_scalars/SpecifiedByOldSyntaxEscapesUrl.invalid.ts:3:4 - error: The `@specifiedBy` tag has been deprecated in favor of `@gqlAnnotate`. Use `@gqlAnnotate specifiedBy(url: "http://example.com")` instead.

3  * @specifiedBy https://example.com/"uuid"\spec
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~
```

#### Code Action: "Replace @specifiedBy with @gqlAnnotate" (replace-specifiedBy-with-gqlAnnotate)

```diff
- Original
+ Fixed

@@ -2,3 +2,3 @@
   * @gqlScalar
-  * @specifiedBy https://example.com/"uuid"\spec
+  * @gqlAnnotate specifiedBy(url: "https://example.com/\"uuid\"\\spec")
   */
```

#### Applied Fixes

```text
  * Applied fix "Replace @specifiedBy with @gqlAnnotate" in grats/src/tests/fixtures/custom_scalars/SpecifiedByOldSyntaxEscapesUrl.invalid.ts
```

#### Fixed Text

```typescript
/**
 * @gqlScalar
 * @gqlAnnotate specifiedBy(url: "https://example.com/\"uuid\"\\spec")
 */
export type UUID = string;
```