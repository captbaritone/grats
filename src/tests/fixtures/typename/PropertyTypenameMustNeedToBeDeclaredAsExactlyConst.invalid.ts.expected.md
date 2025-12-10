## input

```ts title="typename/PropertyTypenameMustNeedToBeDeclaredAsExactlyConst.invalid.ts"
/** @gqlType */
export class User {
  __typename = "User" as Foo;
  /** @gqlField */
  name: string = "Alice";
}

type Foo = string;
```

## Output

### Error Report

```text
src/tests/fixtures/typename/PropertyTypenameMustNeedToBeDeclaredAsExactlyConst.invalid.ts:3:26 - error: Expected `__typename` property type name to be "const". For example: `__typename = "User" as const` or `__typename: "User";`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

3   __typename = "User" as Foo;
                           ~~~
```

#### Code Action: "Create Grats-compatible `__typename` property" (fix-typename-property)

```diff
- Original
+ Fixed

@@ -2,3 +2,3 @@
  export class User {
-   __typename = "User" as Foo;
+   __typename = "User" as const;
    /** @gqlField */
```

#### Applied Fixes

```text
  * Applied fix "Create Grats-compatible `__typename` property" in grats/src/tests/fixtures/typename/PropertyTypenameMustNeedToBeDeclaredAsExactlyConst.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlType */
export class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string = "Alice";
}

type Foo = string;
```