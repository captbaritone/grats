# field_definitions/PropertyFieldMissingType.invalid.ts

## Input

```ts title="field_definitions/PropertyFieldMissingType.invalid.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  someProp;
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/PropertyFieldMissingType.invalid.ts:4:3 - error: Expected GraphQL field to have an explicitly defined type annotation. Grats needs to be able to see the type of the field to generate a field's type in the GraphQL schema.

4   someProp;
    ~~~~~~~~
```