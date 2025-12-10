## input

```ts title="input_type_one_of/oneOfFieldTypeNotGraphQL.invalid.ts"
/**
 * @gqlInput
 */
export type Greeting = { firstName: string } | { lastName: Set<string> };
```

## Output

### Error Report

```text
src/tests/fixtures/input_type_one_of/oneOfFieldTypeNotGraphQL.invalid.ts:4:60 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

4 export type Greeting = { firstName: string } | { lastName: Set<string> };
                                                             ~~~
```