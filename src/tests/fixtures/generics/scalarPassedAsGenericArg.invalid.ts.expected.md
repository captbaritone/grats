# generics/scalarPassedAsGenericArg.invalid.ts

## Input

```ts title="generics/scalarPassedAsGenericArg.invalid.ts"
/** @gqlType */
type Wrapper<T> = {
  /** @gqlField */
  value: T;
};

/** @gqlType */
type OtherType = {
  /** @gqlField */
  wrapper: Wrapper<string>;
};
```

## Output

### Error Report

```text
src/tests/fixtures/generics/scalarPassedAsGenericArg.invalid.ts:10:20 - error: Expected `Wrapper` to be passed a GraphQL type argument for type parameter `T`.

10   wrapper: Wrapper<string>;
                      ~~~~~~

  src/tests/fixtures/generics/scalarPassedAsGenericArg.invalid.ts:2:14
    2 type Wrapper<T> = {
                   ~
    Type parameter `T` is defined here
  src/tests/fixtures/generics/scalarPassedAsGenericArg.invalid.ts:4:10
    4   value: T;
               ~
    and expects a GraphQL type because it was used in a GraphQL position here.
```