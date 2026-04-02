# Descriptions

GraphQL supports adding descriptions to types, fields, and arguments and more. These descriptions are used by tools like [Graphiql](https://github.com/graphql/graphiql) and [editor integrations](https://marketplace.visualstudio.com/items?itemName=meta.relay) to provide context to developers.

Grats makes it easy to populate these descriptions and keep them in sync with the implementation by using the leading free text in your docblocks as that construct's description.

> **TIP:**
> Both TypeScript and GraphQL expect descriptions to be written in Markdown.

See [Comment Syntax](../getting-started/comment-syntax.md) for more details.

## Example

TypeScriptGraphQL

```tsx
/**
 * A registered user of the system.
 * @gqlType
 */
class User {
  /**
   * A friendly greeting for the user, intended for
   * their first visit.
   * @gqlField
   */
  hello(
    /** The salutation to use */
    greeting: string,
  ): string {
    return `${greeting} World`;
  }
}
```

> **TIP:**
> Depending upon your version of TypeScript, descriptions with a `@` symbol in their text, for example a GitHub handle, may get truncated. To avoid this, you can wrap the tag in quotes or backticks.
> 
> ```text
> /** This comment was added by `@captbaritone`. */
> ```

## Limitations

> **CAUTION:**
> In some cases, TypeScript does not support "attaching" docblock comments to certain constructs. In these cases, Grats is currently unable to extract descriptions.

For example, Grats is **not** currently able to attach descriptions to enum values defined using a type union.

```tsx
/** @gqlEnum */
type GreetingStyle =
  /** For a business greeting */
  | "formal"
  /** For a friendly greeting */
  | "casual";
```

Will _incorrectly_ extract this GraphQL:

```graphql
enum GreetingStyle {
  casual
  formal
}
```
