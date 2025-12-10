## input

```ts title="arguments/NullableArgumentErrors.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello1({ greeting }: { greeting: string | null }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello2({ greeting }: { greeting: string | void }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello3({ greeting }: { greeting: string | undefined }): string {
    return "Hello world!";
  }
  // TODO: This should be an error, but it's not.
  /** @gqlField */
  hello5({ greeting }: { greeting?: string | undefined }): string {
    return "Hello world!";
  }
}
```

## Output

```
-- Error Report --
src/tests/fixtures/arguments/NullableArgumentErrors.invalid.ts:4:26 - error: Expected nullable argument to _also_ be optional (`?`). graphql-js may omit properties on the argument object where an undefined GraphQL variable is passed, or if the argument is omitted in the operation text. To ensure your resolver is capable of handling this scenario, add a `?` to the end of the argument name to make it optional. e.g. `{greeting?: string | null}`

4   hello1({ greeting }: { greeting: string | null }): string {
                           ~~~~~~~~

src/tests/fixtures/arguments/NullableArgumentErrors.invalid.ts:8:26 - error: Expected nullable argument to _also_ be optional (`?`). graphql-js may omit properties on the argument object where an undefined GraphQL variable is passed, or if the argument is omitted in the operation text. To ensure your resolver is capable of handling this scenario, add a `?` to the end of the argument name to make it optional. e.g. `{greeting?: string | null}`

8   hello2({ greeting }: { greeting: string | void }): string {
                           ~~~~~~~~

src/tests/fixtures/arguments/NullableArgumentErrors.invalid.ts:12:26 - error: Expected nullable argument to _also_ be optional (`?`). graphql-js may omit properties on the argument object where an undefined GraphQL variable is passed, or if the argument is omitted in the operation text. To ensure your resolver is capable of handling this scenario, add a `?` to the end of the argument name to make it optional. e.g. `{greeting?: string | null}`

12   hello3({ greeting }: { greeting: string | undefined }): string {
                            ~~~~~~~~


-- Code Action: "Make argument optional" (add-question-token-to-arg) --
- Original
+ Fixed

@@ -3,3 +3,3 @@
    /** @gqlField */
-   hello1({ greeting }: { greeting: string | null }): string {
+   hello1({ greeting }: { greeting?: string | null }): string {
      return "Hello world!";
-- Code Action: "Make argument optional" (add-question-token-to-arg) --
- Original
+ Fixed

@@ -7,3 +7,3 @@
    /** @gqlField */
-   hello2({ greeting }: { greeting: string | void }): string {
+   hello2({ greeting }: { greeting?: string | void }): string {
      return "Hello world!";
-- Code Action: "Make argument optional" (add-question-token-to-arg) --
- Original
+ Fixed

@@ -11,3 +11,3 @@
    /** @gqlField */
-   hello3({ greeting }: { greeting: string | undefined }): string {
+   hello3({ greeting }: { greeting?: string | undefined }): string {
      return "Hello world!";

-- Applied Fixes --
  * Applied fix "Make argument optional" in grats/src/tests/fixtures/arguments/NullableArgumentErrors.invalid.ts
  * Applied fix "Make argument optional" in grats/src/tests/fixtures/arguments/NullableArgumentErrors.invalid.ts
  * Applied fix "Make argument optional" in grats/src/tests/fixtures/arguments/NullableArgumentErrors.invalid.ts

-- Fixed Text --
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello1({ greeting }: { greeting?: string | null }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello2({ greeting }: { greeting?: string | void }): string {
    return "Hello world!";
  }
  /** @gqlField */
  hello3({ greeting }: { greeting?: string | undefined }): string {
    return "Hello world!";
  }
  // TODO: This should be an error, but it's not.
  /** @gqlField */
  hello5({ greeting }: { greeting?: string | undefined }): string {
    return "Hello world!";
  }
}
```