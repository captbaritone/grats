# generics/derivedNamesCollide.invalid.ts

## Input

```ts title="generics/derivedNamesCollide.invalid.ts"
// `Pair<AB, C>` and `Pair<A, BC>` would both be named `ABCPair`.
/** @gqlType */
type A = {
  /** @gqlField */
  a: string;
};
/** @gqlType */
type AB = {
  /** @gqlField */
  ab: string;
};
/** @gqlType */
type BC = {
  /** @gqlField */
  bc: string;
};
/** @gqlType */
type C = {
  /** @gqlField */
  c: string;
};

/** @gqlType */
type Pair<X, Y> = {
  /** @gqlField */
  first: X;
  /** @gqlField */
  second: Y;
};

/** @gqlQueryField */
export function one(): Pair<AB, C> {
  return null as any;
}

/** @gqlQueryField */
export function two(): Pair<A, BC> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/derivedNamesCollide.invalid.ts:37:24 - error: Conflicting name for generic type. Grats names a generic type by prefixing its name with the names of its type arguments, which names this type `ABCPair`. However, a different type is also named `ABCPair`. Rename one of the types involved to avoid the conflict.

37 export function two(): Pair<A, BC> {
                          ~~~~~~~~~~~

  src/tests/fixtures/generics/derivedNamesCollide.invalid.ts:32:24
    32 export function one(): Pair<AB, C> {
                              ~~~~~~~~~~~
    The other type named `ABCPair` is referenced here.
```