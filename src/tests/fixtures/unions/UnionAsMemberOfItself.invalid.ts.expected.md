# unions/UnionAsMemberOfItself.invalid.ts

## Input

```ts title="unions/UnionAsMemberOfItself.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  __typename = "User";
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Entity {
  __typename = "Entity";
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Actor = User | Entity | Actor;
```

## Output

### Error Report

```text
src/tests/fixtures/unions/UnionAsMemberOfItself.invalid.ts:9:16 - error: Expected `__typename` property initializer to be an expression with a const assertion. For example: `__typename = "User" as const` or `__typename: "User";`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

9   __typename = "User";
                 ~~~~~~

src/tests/fixtures/unions/UnionAsMemberOfItself.invalid.ts:16:16 - error: Expected `__typename` property initializer to be an expression with a const assertion. For example: `__typename = "Entity" as const` or `__typename: "Entity";`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

16   __typename = "Entity";
                  ~~~~~~~~
```

#### Code Action: "Create Grats-compatible `__typename` property" (fix-typename-property)

```diff
- Original
+ Fixed

@@ -8,3 +8,3 @@
  class User {
-   __typename = "User";
+   __typename = "User" as const;
    /** @gqlField */
```

#### Code Action: "Create Grats-compatible `__typename` property" (fix-typename-property)

```diff
- Original
+ Fixed

@@ -15,3 +15,3 @@
  class Entity {
-   __typename = "Entity";
+   __typename = "Entity" as const;
    /** @gqlField */
```

#### Applied Fixes

```text
  * Applied fix "Create Grats-compatible `__typename` property" in grats/src/tests/fixtures/unions/UnionAsMemberOfItself.invalid.ts
  * Applied fix "Create Grats-compatible `__typename` property" in grats/src/tests/fixtures/unions/UnionAsMemberOfItself.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Entity {
  __typename = "Entity" as const;
  /** @gqlField */
  description: string;
}

/** @gqlUnion */
type Actor = User | Entity | Actor;
```