# generics/typeParamAfterUnresolvedTypeArg.invalid.ts

## Input

```ts title="generics/typeParamAfterUnresolvedTypeArg.invalid.ts"
// An unresolvable type argument is reported without hiding that `Wrapper` is
// generic.
/** @gqlType */
type Post = {
  /** @gqlField */
  title: string;
};

/** @gqlType */
type Pair<A, B> = {
  /** @gqlField */
  first: A;
  /** @gqlField */
  second: B;
};

/** @gqlType */
type Wrapper<T> = {
  /** @gqlField */
  pair: Pair<Undefined, T>;
};

/** @gqlQueryField */
export function wrapper(): Wrapper<Post> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/typeParamAfterUnresolvedTypeArg.invalid.ts:20:14 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

20   pair: Pair<Undefined, T>;
                ~~~~~~~~~
src/tests/fixtures/generics/typeParamAfterUnresolvedTypeArg.invalid.ts:20:14 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

20   pair: Pair<Undefined, T>;
                ~~~~~~~~~
```