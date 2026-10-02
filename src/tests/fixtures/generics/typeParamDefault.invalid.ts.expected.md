# generics/typeParamDefault.invalid.ts

## Input

```ts title="generics/typeParamDefault.invalid.ts"
// Type parameter defaults are not supported.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Page<T = User> = {
  /** @gqlField */
  items: T[];
};

/** @gqlQueryField */
export function users(): Page {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/typeParamDefault.invalid.ts:15:26 - error: Missing type argument for generic GraphQL type. Expected `Page` to be passed a GraphQL type argument for type parameter `T`.

15 export function users(): Page {
                            ~~~~

  src/tests/fixtures/generics/typeParamDefault.invalid.ts:9:11
    9 type Page<T = User> = {
                ~~~~~~~~
    Type parameter `T` is defined here
  src/tests/fixtures/generics/typeParamDefault.invalid.ts:11:10
    11   items: T[];
                ~
    and expects a GraphQL type because it was used in a GraphQL position here.
```