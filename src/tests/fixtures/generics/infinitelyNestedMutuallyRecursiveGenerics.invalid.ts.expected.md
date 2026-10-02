# generics/infinitelyNestedMutuallyRecursiveGenerics.invalid.ts

## Input

```ts title="generics/infinitelyNestedMutuallyRecursiveGenerics.invalid.ts"
// Generic types which reference each other with more deeply nested type
// arguments would expand into infinitely many types.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};

/** @gqlType */
type Parent<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  child: Child<T>;
};

/** @gqlType */
type Child<T> = {
  /** @gqlField */
  parent: Parent<Edge<T>>;
};

/** @gqlQueryField */
export function parent(): Parent<User> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/infinitelyNestedMutuallyRecursiveGenerics.invalid.ts:26:11 - error: Infinitely nested generic type. Grats defines a GraphQL type for each combination of type arguments a generic type is used with. Here, each type Grats defines would use the generic type with more deeply nested type arguments, so Grats would need to define infinitely many types.

26   parent: Parent<Edge<T>>;
             ~~~~~~~~~~~~~~~
```