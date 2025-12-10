## input

```ts title="generics/undefinedTypeUsedAsGenericTypeArg.invalid.ts"
/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
export type PageConnection = {
  /** @gqlField */
  edges: Edge<Oops>[];
};
```

## Output

### Error Report

```text
src/tests/fixtures/generics/undefinedTypeUsedAsGenericTypeArg.invalid.ts:12:15 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

12   edges: Edge<Oops>[];
                 ~~~~
```