## input

```ts title="input_types/inputFieldWithGqlField.invalid.ts"
/** @gqlInput */
type Foo = {
  /** @gqlField */
  name: string;
};
```

## Output

```
-- Error Report --
src/tests/fixtures/input_types/inputFieldWithGqlField.invalid.ts:3:7 - error: The tag `@gqlField` is not needed on fields of input types. All fields are automatically included as part of the input type. This tag can be safely removed.

3   /** @gqlField */
        ~~~~~~~~~~


-- Code Action: "Remove @gqlField tag" (remove-gql-field-from-input) --
- Original
+ Fixed

@@ -2,3 +2,3 @@
  type Foo = {
-   /** @gqlField */
+   
    name: string;

-- Applied Fixes --
  * Applied fix "Remove @gqlField tag" in grats/src/tests/fixtures/input_types/inputFieldWithGqlField.invalid.ts

-- Fixed Text --
/** @gqlInput */
type Foo = {
  
  name: string;
};
```