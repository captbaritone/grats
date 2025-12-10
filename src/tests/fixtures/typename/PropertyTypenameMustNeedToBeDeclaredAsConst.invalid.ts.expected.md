## input

```ts title="typename/PropertyTypenameMustNeedToBeDeclaredAsConst.invalid.ts"
/** @gqlType */
export class User {
  __typename = "User";
  /** @gqlField */
  name: string = "Alice";
}
```

## Output

### Error Report

```text
src/tests/fixtures/typename/PropertyTypenameMustNeedToBeDeclaredAsConst.invalid.ts:3:16 - error: Expected `__typename` property initializer to be an expression with a const assertion. For example: `__typename = "User" as const` or `__typename: "User";`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

3   __typename = "User";
                 ~~~~~~
```

#### Code Action: "Create Grats-compatible `__typename` property" (fix-typename-property)

```diff
- Original
+ Fixed

@@ -2,3 +2,3 @@
  export class User {
-   __typename = "User";
+   __typename = "User" as const;
    /** @gqlField */
```

#### Applied Fixes

```text
  * Applied fix "Create Grats-compatible `__typename` property" in grats/src/tests/fixtures/typename/PropertyTypenameMustNeedToBeDeclaredAsConst.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlType */
export class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string = "Alice";
}
```