## input

```ts title="typename/PropertyTypenameDoesNotMatchClassName.invalid.ts"
/** @gqlType */
export class User {
  __typename = "Group" as const;
  /** @gqlField */
  name: string = "Alice";
}
```

## Output

### Error Report

```text
src/tests/fixtures/typename/PropertyTypenameDoesNotMatchClassName.invalid.ts:3:16 - error: Expected `__typename` property initializer to be `"User"`, found `"Group"`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

3   __typename = "Group" as const;
                 ~~~~~~~
```

#### Code Action: "Create Grats-compatible `__typename` property" (fix-typename-property)

```diff
- Original
+ Fixed

@@ -2,3 +2,3 @@
  export class User {
-   __typename = "Group" as const;
+   __typename = "User" as const;
    /** @gqlField */
```

#### Applied Fixes

```text
* Applied fix "Create Grats-compatible `__typename` property" in grats/src/tests/fixtures/typename/PropertyTypenameDoesNotMatchClassName.invalid.ts
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