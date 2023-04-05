# Descriptions

GraphQL supports adding descriptions to types, fields, and arguments and more. These descriptions are used by tools like [Graphiql](https://github.com/graphql/graphiql) and [editor integrations](https://marketplace.visualstudio.com/items?itemName=meta.relay) to provide context to developers.

Grats makes it easy to populate these descriptions and keep them in sync with the implementaiton by using the leading free text in your docblocks as that construct's description.

## Example

```ts
/** 
// highlight-start
 * A registered user of the system.
// highlight-end
 * @gqlType
 */
class User {
  /** 
// highlight-start
   * A friendly greeting for the user, intended for 
   * their first visit.
// highlight-end
   * @gqlField
   */
  hello(args: { 
// highlight-start
    /** The salutation to use */
// highlight-end
    greeting: string
  }): string {
    return `${args.greeting} World`;
  }
}
```

Would extract:

```graphql
# highlight-start
"""A registered user of the system."""
# highlight-end
type User {
# highlight-start
  """
  A friendly greeting for the user, intended for 
  their first visit.
  """
# highlight-end
  hello(
# highlight-start
    """The salutation to use"""
# highlight-end
    greeting: String!
  ): String!
}
```

## Limitations

In some cases, TypeScript does not support "attaching" docblock comments to certain constructs. In these cases, Grats is currently unable to extract descriptions.

For example, Grats is **not** currently able to attach descriptions to enum values defined using a type union.

```ts
/** @gqlEnum */
type GreetingStyle = 
// highlight-start
  /** For a business greeting */
// highlight-end
  | 'formal' 
// highlight-start
  /** For a friendly greeting */
// highlight-end
  | 'casual';
```

