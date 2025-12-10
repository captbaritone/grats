## input

```ts title="user_error/DuplicateOneOfTag.invalid.ts"
/**
 * @gqlInput
 * @oneOf
 * @oneOf
 */
type Foo = {
  a: string;
};
```

## Output

### Error Report

```text
src/tests/fixtures/user_error/DuplicateOneOfTag.invalid.ts:3:4 - error: Unexpected duplicate `@oneOf` tag. Grats does not accept multiple instances of the same tag.

3  * @oneOf
     ~~~~~~
4  * @oneOf
  ~~~

  src/tests/fixtures/user_error/DuplicateOneOfTag.invalid.ts:4:4
    4  * @oneOf
         ~~~~~~
    5  */
      ~
    Additional tag
```

#### Code Action: "Remove duplicate @oneOf tag" (remove-duplicate-tag)

```diff
- Original
+ Fixed

@@ -3,4 +3,3 @@
   * @oneOf
-  * @oneOf
-  */
+  * */
  type Foo = {
```

#### Applied Fixes

```text
* Applied fix "Remove duplicate @oneOf tag" in grats/src/tests/fixtures/user_error/DuplicateOneOfTag.invalid.ts
```

#### Fixed Text

```typescript
/**
 * @gqlInput
 * @oneOf
 * */
type Foo = {
  a: string;
};
```