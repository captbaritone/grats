## input

```ts title="typename/PropertySignatureTypenameIncorrectName.invalid.ts"
/** @gqlType */
export class User implements IPerson {
  __typename: "Group";
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

```
-- Error Report --
src/tests/fixtures/typename/PropertySignatureTypenameIncorrectName.invalid.ts:3:15 - error: Expected `__typename` property to be `"User"`. This is needed to ensure Grats can determine the type of this object during GraphQL execution.

3   __typename: "Group";
                ~~~~~~~


-- Code Action: "Create Grats-compatible `__typename` type" (fix-typename-type) --
- Original
+ Fixed

@@ -2,3 +2,3 @@
  export class User implements IPerson {
-   __typename: "Group";
+   __typename: "User";
    /** @gqlField */

-- Applied Fixes --
  * Applied fix "Create Grats-compatible `__typename` type" in grats/src/tests/fixtures/typename/PropertySignatureTypenameIncorrectName.invalid.ts

-- Fixed Text --
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