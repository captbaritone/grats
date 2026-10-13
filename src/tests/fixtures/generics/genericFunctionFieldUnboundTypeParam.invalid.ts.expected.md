# generics/genericFunctionFieldUnboundTypeParam.invalid.ts

## Input

```ts title="generics/genericFunctionFieldUnboundTypeParam.invalid.ts"
/** @gqlType */
export class Page<T> {
  /** @gqlField */
  items: T[];
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;
}

/** `U` isn't one of `Page`'s type arguments, so nothing says what it is. @gqlField */
export function other<T, U>(page: Page<T>): U | null {
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
src/tests/fixtures/generics/genericFunctionFieldUnboundTypeParam.invalid.ts:14:45 - error: Unexpected type parameter in a GraphQL position. Grats needs a concrete GraphQL type here, and a type parameter is only known at each use site.

14 export function other<T, U>(page: Page<T>): U | null {
                                               ~

  src/tests/fixtures/generics/genericFunctionFieldUnboundTypeParam.invalid.ts:14:26
    14 export function other<T, U>(page: Page<T>): U | null {
                                ~
    Defined here
```