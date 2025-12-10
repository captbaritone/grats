## input

```ts title="custom_scalars/SpecifiedByOldSyntax.invalid.ts"
/**
 * @gqlScalar
 * @specifiedBy https://tools.ietf.org/html/rfc4122
 */
export type UUID = string;
```

## Output

```
-- Error Report --
src/tests/fixtures/custom_scalars/SpecifiedByOldSyntax.invalid.ts:3:4 - error: The `@specifiedBy` tag has been deprecated in favor of `@gqlAnnotate`. Use `@gqlAnnotate specifiedBy(url: "http://example.com")` instead.

3  * @specifiedBy https://tools.ietf.org/html/rfc4122
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~


-- Code Action: "Replace @specifiedBy with @gqlAnnotate" (replace-specifiedBy-with-gqlAnnotate) --
- Original
+ Fixed

@@ -2,4 +2,3 @@
   * @gqlScalar
-  * @specifiedBy https://tools.ietf.org/html/rfc4122
-  */
+  * @gqlAnnotate specifiedBy(url: "https://tools.ietf.org/html/rfc4122")*/
  export type UUID = string;

-- Applied Fixes --
  * Applied fix "Replace @specifiedBy with @gqlAnnotate" in grats/src/tests/fixtures/custom_scalars/SpecifiedByOldSyntax.invalid.ts

-- Fixed Text --
/**
 * @gqlScalar
 * @gqlAnnotate specifiedBy(url: "https://tools.ietf.org/html/rfc4122")*/
export type UUID = string;
```