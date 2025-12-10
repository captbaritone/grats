## input

```ts title="generics/arrayPassedToGeneric.invalid.ts"
/** @gqlType */
type Page = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
export type SomeType<T> = {
  /** @gqlField */
  someField: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type Foo = {
  // We should be able to support this eventually
  /** @gqlField */
  a: SomeType<Page[]>;
  // We should be able to support this eventually
  /** @gqlField */
  b: SomeType<Array<Page>>;
  /** @gqlField */
  c: SomeType<Page | null>;
};
```

## Output

```
src/tests/fixtures/generics/arrayPassedToGeneric.invalid.ts:19:15 - error: Expected `SomeType` to be passed a GraphQL type argument for type parameter `T`.

19   a: SomeType<Page[]>;
                 ~~~~~~

  src/tests/fixtures/generics/arrayPassedToGeneric.invalid.ts:8:22
    8 export type SomeType<T> = {
                           ~
    Type parameter `T` is defined here
  src/tests/fixtures/generics/arrayPassedToGeneric.invalid.ts:10:14
    10   someField: T;
                    ~
    and expects a GraphQL type because it was used in a GraphQL position here.
src/tests/fixtures/generics/arrayPassedToGeneric.invalid.ts:22:15 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

22   b: SomeType<Array<Page>>;
                 ~~~~~
src/tests/fixtures/generics/arrayPassedToGeneric.invalid.ts:24:15 - error: Expected `SomeType` to be passed a GraphQL type argument for type parameter `T`.

24   c: SomeType<Page | null>;
                 ~~~~~~~~~~~

  src/tests/fixtures/generics/arrayPassedToGeneric.invalid.ts:8:22
    8 export type SomeType<T> = {
                           ~
    Type parameter `T` is defined here
  src/tests/fixtures/generics/arrayPassedToGeneric.invalid.ts:10:14
    10   someField: T;
                    ~
    and expects a GraphQL type because it was used in a GraphQL position here.
```