# Deprecated

The GraphQL spec supports marking fields and enum values as [`@deprecated`](https://spec.graphql.org/draft/#sec--deprecated) with an optional reason. This is a great way to communicate to clients that a field is no longer supported, and should be replaced with another field.

Grats supports this feature by using the `@deprecated` JSDoc tag. This tag can be used on fields, enum variants, and arguments. If the tag is followed by text, that text is used as the reason for the deprecation.

## Example

```ts
/** @gqlType */
class Query {

  /**
   * @gqlField
// highlight-start
   * @deprecated Please use myNewField instead.
// highlight-end
   */
  oldField: string;

  /** @gqlField */
  newField: string;
}
```

Would extract:

```graphql
type Query {
  oldField: String @deprecated(reason: "Please use myNewField instead.")
  newField: String
}
```
