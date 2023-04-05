# Field Nullability

By default, Grats makes all fields nullabl* in keeping with **[GraphQL
best practices](https://graphql.org/learn/best-practices/#nullability)**. This
behavior can be changed by setting the [config option](/docs/getting-started/configuration) `{ "nullableByDefault": false }`.

With `nullableByDefault` _enabled_, you may declare an individual field as
nonnullable adding the docblock tag `@killsParentOnException`.  This will cause
the field to be typed as non-nullable, but _it comes at a price_.  Should the
resolver throw, the error will bubble up to the first nullable parent. If
`@killsParentOnException` is used too liberally, small errors can take down huge
portions of your query.

Dissabling `nullableByDefault` is equivilent to marking all nonnullable fields
with `@killsParentOnException`.

```ts
/**
 * @gqlField
// highlight-start
 * @killsParentOnException
// highlight-end
 */
myField(): string {
  return this.someOtherMethod();
}
```
