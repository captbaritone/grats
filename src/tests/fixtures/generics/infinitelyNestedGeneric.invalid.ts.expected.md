# generics/infinitelyNestedGeneric.invalid.ts

## Input

```ts title="generics/infinitelyNestedGeneric.invalid.ts"
// A generic type which references itself with more deeply nested type
// arguments would expand into infinitely many types.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Tree<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  children: Tree<Tree<T>>;
};

/** @gqlQueryField */
export function tree(): Tree<User> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/infinitelyNestedGeneric.invalid.ts:14:13 - error: Infinitely nested generic type. Grats defines a GraphQL type for each combination of type arguments a generic type is used with. Here, each type Grats defines would use the generic type with more deeply nested type arguments, so Grats would need to define infinitely many types.

14   children: Tree<Tree<T>>;
               ~~~~~~~~~~~~~
```