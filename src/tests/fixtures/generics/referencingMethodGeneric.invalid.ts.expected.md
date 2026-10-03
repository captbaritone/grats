# generics/referencingMethodGeneric.invalid.ts

## Input

```ts title="generics/referencingMethodGeneric.invalid.ts"
/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting<T>(_: Query): T {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/referencingMethodGeneric.invalid.ts:5:40 - error: Unexpected type parameter in a GraphQL position. Grats needs a concrete GraphQL type here, and a type parameter is only known at each use site.

5 export function greeting<T>(_: Query): T {
                                         ~

  src/tests/fixtures/generics/referencingMethodGeneric.invalid.ts:5:26
    5 export function greeting<T>(_: Query): T {
                               ~
    Defined here
```