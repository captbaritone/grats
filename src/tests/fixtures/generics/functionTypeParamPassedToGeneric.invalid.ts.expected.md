# generics/functionTypeParamPassedToGeneric.invalid.ts

## Input

```ts title="generics/functionTypeParamPassedToGeneric.invalid.ts"
// Only type parameters of the generic GraphQL type itself are supported.
/** @gqlType */
type Page<T> = {
  /** @gqlField */
  items: T[];
};

/** @gqlQueryField */
export function users<T>(): Page<T> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/functionTypeParamPassedToGeneric.invalid.ts:9:34 - error: Unexpected type parameter in a GraphQL position. Grats needs a concrete GraphQL type here, and a type parameter is only known at each use site.

9 export function users<T>(): Page<T> {
                                   ~

  src/tests/fixtures/generics/functionTypeParamPassedToGeneric.invalid.ts:9:23
    9 export function users<T>(): Page<T> {
                            ~
    Defined here
```