## input

```ts title="field_definitions/FieldAsStaticClassMethodNotExported.invalid.ts"
/** @gqlType */
class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static getUser(_: Query): User {
    return new User();
  }
}

/** @gqlType */
type Query = unknown;
```

## Output

```
-- Error Report --
src/tests/fixtures/field_definitions/FieldAsStaticClassMethodNotExported.invalid.ts:2:7 - error: Expected `@gqlField` static method's class to be exported. Grats needs to import resolvers into its generated schema module, so the resolver class must be an exported.

2 class User {
        ~~~~

  src/tests/fixtures/field_definitions/FieldAsStaticClassMethodNotExported.invalid.ts:6:7
    6   /** @gqlField */
            ~~~~~~~~~~
    Field defined here

-- Code Action: "Add export keyword to class with static @gqlField" (add-export-keyword-to-class) --
- Original
+ Fixed

@@ -1,3 +1,3 @@
  /** @gqlType */
- class User {
+ export class User {
    /** @gqlField */

-- Applied Fixes --
  * Applied fix "Add export keyword to class with static @gqlField" in grats/src/tests/fixtures/field_definitions/FieldAsStaticClassMethodNotExported.invalid.ts

-- Fixed Text --
/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static getUser(_: Query): User {
    return new User();
  }
}

/** @gqlType */
type Query = unknown;
```