# generics/derivedNameCollidesWithType.invalid.ts

## Input

```ts title="generics/derivedNameCollidesWithType.invalid.ts"
// The name Grats derives for `Edge<User>` collides with the `UserEdge` type.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type UserEdge = {
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};

/** @gqlQueryField */
export function edge(): Edge<User> {
  return null as any;
}

/** @gqlQueryField */
export function userEdge(): UserEdge {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/derivedNameCollidesWithType.invalid.ts:9:6 - error: There can be only one type named "UserEdge".

9 type UserEdge = {
       ~~~~~~~~

  src/tests/fixtures/generics/derivedNameCollidesWithType.invalid.ts:21:25
    21 export function edge(): Edge<User> {
                               ~~~~~~~~~~
    Related location
```