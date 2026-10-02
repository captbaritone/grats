# generics/errorInGenericReportedOnce.invalid.ts

## Input

```ts title="generics/errorInGenericReportedOnce.invalid.ts"
// An error in a generic type is reported once, rather than once for each type
// materialized from it.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
/** @gqlType */
type Post = {
  /** @gqlField */
  title: string;
};

/** @gqlType */
type Page<T> = {
  /** @gqlField */
  items: T[];
  /** @gqlField */
  bad: Undefined;
};

/** @gqlQueryField */
export function users(): Page<User> {
  return null as any;
}

/** @gqlQueryField */
export function posts(): Page<Post> {
  return null as any;
}
```

## Output

### Error Report

```text
src/tests/fixtures/generics/errorInGenericReportedOnce.invalid.ts:19:8 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

19   bad: Undefined;
          ~~~~~~~~~
```