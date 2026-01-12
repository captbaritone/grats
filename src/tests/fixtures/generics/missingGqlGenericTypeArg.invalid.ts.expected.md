# generics/missingGqlGenericTypeArg.invalid.ts

## Input

```ts title="generics/missingGqlGenericTypeArg.invalid.ts"
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
  edges: Edge</* Oops! */>[];
};
```

## Output

### Error Report

```text
src/tests/fixtures/generics/missingGqlGenericTypeArg.invalid.ts:12:10 - error: Missing type argument for generic GraphQL type. Expected `Edge` to be passed a GraphQL type argument for type parameter `T`.

12   edges: Edge</* Oops! */>[];
            ~~~~~~~~~~~~~~~~~

  src/tests/fixtures/generics/missingGqlGenericTypeArg.invalid.ts:2:11
    2 type Edge<T> = {
                ~
    Type parameter `T` is defined here
  src/tests/fixtures/generics/missingGqlGenericTypeArg.invalid.ts:4:9
    4   node: T;
              ~
    and expects a GraphQL type because it was used in a GraphQL position here.
```