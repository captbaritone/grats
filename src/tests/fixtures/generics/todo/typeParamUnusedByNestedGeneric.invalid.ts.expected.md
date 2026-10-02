# generics/todo/typeParamUnusedByNestedGeneric.invalid.ts

## Input

```ts title="generics/todo/typeParamUnusedByNestedGeneric.invalid.ts"
// TODO: This should not be an error. `Bar` doesn't use its type parameter in a
// GraphQL position, so `Foo`'s type parameter need not be a GraphQL type.
/** @gqlType */
type Bar<U> = {
  /** @gqlField */
  name: string;
  notGql: U;
};

/** @gqlType */
type Foo<T> = {
  /** @gqlField */
  bar: Bar<T>;
};

/** @gqlQueryField */
export function foo(): Foo<string> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/todo/typeParamUnusedByNestedGeneric.invalid.ts:17:28 - error: Expected `Foo` to be passed a GraphQL type argument for type parameter `T`.

17 export function foo(): Foo<string> {
                              ~~~~~~

  src/tests/fixtures/generics/todo/typeParamUnusedByNestedGeneric.invalid.ts:11:10
    11 type Foo<T> = {
                ~
    Type parameter `T` is defined here
  src/tests/fixtures/generics/todo/typeParamUnusedByNestedGeneric.invalid.ts:13:12
    13   bar: Bar<T>;
                  ~
    and expects a GraphQL type because it was used in a GraphQL position here.
```