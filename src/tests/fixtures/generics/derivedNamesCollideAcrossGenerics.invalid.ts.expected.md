# generics/derivedNamesCollideAcrossGenerics.invalid.ts

## Input

```ts title="generics/derivedNamesCollideAcrossGenerics.invalid.ts"
// `Edge<UserConnection>` and `ConnectionEdge<User>` would both be named
// `UserConnectionEdge`.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
/** @gqlType */
type UserConnection = {
  /** @gqlField */
  count: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};
/** @gqlType */
type ConnectionEdge<T> = {
  /** @gqlField */
  cursor: string;
  /** @gqlField */
  item: T;
};

/** @gqlQueryField */
export function one(): Edge<UserConnection> {
  return null as any;
}

/** @gqlQueryField */
export function two(): ConnectionEdge<User> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/derivedNamesCollideAcrossGenerics.invalid.ts:33:24 - error: Conflicting name for generic type. Grats names a generic type by prefixing its name with the names of its type arguments, which names this type `UserConnectionEdge`. However, a different type is also named `UserConnectionEdge`. Rename one of the types involved to avoid the conflict.

33 export function two(): ConnectionEdge<User> {
                          ~~~~~~~~~~~~~~~~~~~~

  src/tests/fixtures/generics/derivedNamesCollideAcrossGenerics.invalid.ts:28:24
    28 export function one(): Edge<UserConnection> {
                              ~~~~~~~~~~~~~~~~~~~~
    The other type named `UserConnectionEdge` is referenced here.
```