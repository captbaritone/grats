## input

```ts title="extend_interface/addStringFieldToNonGrats.invalid.ts"
type SomeNonGratsType = string;

/** @gqlField */
export function greeting(someType: SomeNonGratsType): string {
  return `Hello ${someType}!`;
}
```

## Output

```
src/tests/fixtures/extend_interface/addStringFieldToNonGrats.invalid.ts:4:36 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

4 export function greeting(someType: SomeNonGratsType): string {
                                     ~~~~~~~~~~~~~~~~
```