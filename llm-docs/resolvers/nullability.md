# Field Nullability

By default, Grats makes all fields nullable in keeping with **[GraphQL best practices](https://graphql.org/learn/best-practices/#nullability)**. By modeling fields as nullable by default, any error encountered when evaluating a resolver function/method will be caught by the GraphQL executor and returned as a `null` value with error metadata attached to the response.

This approach allows for maximally resilient network requests, since a single error will not take down the entire query, generally it will only affect the field that threw the error.

If you find this pervasive nullability makes client application development frustrating, you may wish to enable [Semantic Nullability](../guides/strict-semantic-nullability.md).

## @killsParentOnException

However, there are some fields where it is necessary to have a non-nullable field, for example for `id`. In this case, you may add the docblock tag `@killsParentOnException` to the field. This will cause the field to be typed as non-nullable, but _it comes at a price_. Should the resolver throw, the error will bubble up to the first nullable parent.

> **CAUTION:**
> If `@killsParentOnException` is used too liberally, small errors can take down huge portions of your query.

```tsx
/** @gqlType */
class MyType {
  /**
   * @gqlField
   * @killsParentOnException
   */
  myField(): string {
    if (Math.random() > 0.5) {
      throw new Error("Bang");
    }
    return "Whew!";
  }
}
```

Would extract:

```graphql
type MyType {
  myField: String!
}
```

## Changing the default

This behavior can be changed by setting the [config option](../getting-started/configuration.md) `{ "nullableByDefault": false }`.

> **DANGER:**
> Disabling `nullableByDefault` is equivalent to marking all non-nullable fields as `@killsParentOnException`.
