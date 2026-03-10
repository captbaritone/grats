# Deprecated

GraphQL supports marking fields, input fields, arguments and enum values as [`@deprecated`](https://spec.graphql.org/draft/#sec--deprecated) with an optional reason. These directives are used by tools like [Graphiql](https://github.com/graphql/graphiql) and [editor integrations](https://marketplace.visualstudio.com/items?itemName=meta.relay) to provide context to developers.

Grats supports this feature by using the `@deprecated` JSDoc tag. This tag can be used on fields, enum variants, and arguments. If the tag is followed by text, that text is used as the reason for the deprecation.

## Field example

```tsx
/** @gqlType */
class User {
  /**
   * @gqlField
   * @deprecated Please use myNewField instead.
   */
  oldField: string;

  /** @gqlField */
  newField: string;
}
```

Would extract:

```graphql
type User {
  newField: String
  oldField: String @deprecated(reason: "Please use myNewField instead.")
}
```

## Overlap with TypeScript's `@deprecated`

TypeScript also has special treatment of constructs with the `@deprecated` in their JSDoc docblock. Specifically, it will render uses of them as struckthrough and greyed out in the editor. In general this overlap is a feature, since deprecated fields should also generally not be used internally. However, if you wish to deprecate a field/argument/etc. in you schema, but not in your code, you can define a new method/function specifically for GraphQL which wraps the non-deprecated version. For example:

```tsx
/** @gqlType */
class User {
  // Not deprecated!
  name: string;

  /**
   * @gqlField name
   * @deprecated Not supported externally any more
   */
  graphQLName(): string {
    return this.name;
  }
}
```
