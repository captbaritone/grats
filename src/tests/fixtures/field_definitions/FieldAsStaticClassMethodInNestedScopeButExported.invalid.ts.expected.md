## input

```ts title="field_definitions/FieldAsStaticClassMethodInNestedScopeButExported.invalid.ts"
function main() {
  /** @gqlType */
  export class User {
    /** @gqlField */
    name: string;

    /** @gqlField */
    static getUser(_: Query): User {
      return new User();
    }
  }
}

/** @gqlType */
type Query = unknown;
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/FieldAsStaticClassMethodInNestedScopeButExported.invalid.ts:3:16 - error: Expected class with a static `@gqlField` method to be a top-level declaration. Grats needs to import resolver methods into its generated schema module, so the resolver's class must be an exported.

3   export class User {
                 ~~~~

  src/tests/fixtures/field_definitions/FieldAsStaticClassMethodInNestedScopeButExported.invalid.ts:7:9
    7     /** @gqlField */
              ~~~~~~~~~~
    Field defined here
```