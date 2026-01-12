# typename/PropertySignatureTypenameNonLiteralType.invalid.ts

## Input

```ts title="typename/PropertySignatureTypenameNonLiteralType.invalid.ts"
/** @gqlType */
export class User implements IPerson {
  __typename: string;
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/typename/PropertySignatureTypenameNonLiteralType.invalid.ts:3:15 - error: Expected `__typename` property signature to specify the typename as a string literal string type. For example `__typename: "User";`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

3   __typename: string;
                ~~~~~~
```

#### Code Action: "Create Grats-compatible `__typename` type" (fix-typename-type)

```diff
- Original
+ Fixed

@@ -2,3 +2,3 @@
  export class User implements IPerson {
-   __typename: string;
+   __typename: "User";
    /** @gqlField */
```

#### Applied Fixes

```text
  * Applied fix "Create Grats-compatible `__typename` type" in grats/src/tests/fixtures/typename/PropertySignatureTypenameNonLiteralType.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlType */
export class User implements IPerson {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
export interface IPerson {
  /** @gqlField */
  name: string;
}
```