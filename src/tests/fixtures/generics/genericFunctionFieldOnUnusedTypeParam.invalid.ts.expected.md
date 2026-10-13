# generics/genericFunctionFieldOnUnusedTypeParam.invalid.ts

## Input

```ts title="generics/genericFunctionFieldOnUnusedTypeParam.invalid.ts"
/** `T` is never used in a GraphQL position, so `Page` isn't generic. @gqlType */
export class Page<T> {
  /** @gqlField */
  count: string;
  items: T[];
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;
}

/** @gqlField */
export function first<T>(page: Page<T>): T | null {
  return null;
}

/** @gqlQueryField */
export function users(): Page<User> {
  return new Page();
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/genericFunctionFieldOnUnusedTypeParam.invalid.ts:15:42 - error: Unexpected type parameter in a GraphQL position. Grats needs a concrete GraphQL type here, and a type parameter is only known at each use site.

15 export function first<T>(page: Page<T>): T | null {
                                            ~

  src/tests/fixtures/generics/genericFunctionFieldOnUnusedTypeParam.invalid.ts:15:23
    15 export function first<T>(page: Page<T>): T | null {
                             ~
    Defined here
```