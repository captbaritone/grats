## input

```ts title="field_definitions/ReferenceNonGraphQLType.invalid.ts"
type SomeUndefienedType = string;

/** @gqlType */
class SomeType {
  /** @gqlField */
  somePropertyField: SomeUndefienedType;
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/ReferenceNonGraphQLType.invalid.ts:6:22 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

6   somePropertyField: SomeUndefienedType;
                       ~~~~~~~~~~~~~~~~~~
```