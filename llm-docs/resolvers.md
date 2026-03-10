# Resolvers

Grats leverages [`graphql-js`](https://graphql.org/graphql-js/) for its execution engine, this means each resolver has access to the [conventional four arguments](https://graphql.org/learn/execution/#root-fields-resolvers). However, Grats tries to let you be more flexible in how you define your resolvers. This means that you don't have to match the exact signature of the `graphql-js` resolver function. As long as Grats can infer which value you are trying to access for each arguemtn, Grat's will provide the mapping from the `graphql-js` resolver signature to your resolvers signature. This means you are free to omit or reorder the arguments as you see fit.

### `obj`

The parent object, which for a field on the root Query type is often not used.

> **NOTE:**
> When defining your resolvers as methods on a class, the initial `obj` argument is omitted in favor of `this`.

When using the functional or static method style, this must be the first arguemnt. Grats inspects the type annotation of the first argument to determine which which type this field is being defined on. In other word, the definition of the type applied to the `obj` argument must be annotated with `/** @gqlType */`. Grats will report a helpful error if you forget to do this.

### `args`

The arguments provided to the field in the GraphQL query.

Args can be accessed by _either_ of two different styles:

-   Object map: The resolver defines are argument with an **explicit** inline literal type. Grats will inspect this type declaration to determine the GraphQL type of the expected arguments.
-   Positional arguments: Individual top-level arguments of the resolver may be typed with GraphQL types. Grats will infer the argument type and name from the type declaration, and pass the matching named argument value to the resolver in that position.

See [Arguments](./docblock-tags/arguments.md).

### `context`

A value which is provided to every resolver and holds important contextual information. This generally used for things like:

-   Information about the current request
-   Context about the currently logged in user
-   Per-request caches, such as [DataLoaders](https://github.com/graphql/dataloader)

Grats will expects you to annotate your context object with `/** @gqlContext */`. Any argument typed using that type will be passed the context object.

See [Context](./docblock-tags/context.md).

### `info`

A value which holds field-specific information relevant to the current query as well as the schema details, also refer to type [GraphQLResolveInfo](https://graphql.org/graphql-js/type/#graphqlobjecttype) for more details.

This is rarely used, but can be useful for advanced cases such as trying to optimize database queries to perform joins or only fetch the fields that are actually requested.

Grats will pass the info object to any argument that is typed with the `GqlInfo` type exported from `grats`.

See [Info](./docblock-tags/info.md).

## Class Method Example

```tsx
/** @gqlType */
class User {
  _bestFriendID: number;
  /** @gqlField */
  bestFriend(order: string, context: GqlContext): User {
    return context.db.getSortedFriends(this._bestFriendID, order);
  }
}

/** @gqlContext */
type GqlContext = {
  db: { getSortedFriends(id: number, order: string): User };
};
```

## Functional Style Example

> **NOTE:**
> Grats will inspect the type of the first argument in order to determine which GraphQL type the field is being added to.

```tsx
/** @gqlType */
type User = {
  _bestFriendID: number;
};

/** @gqlField */
export function friends(user: User, order: string, context: GqlContext): User {
  return context.db.getSortedFriends(user._bestFriendID, order);
}

/** @gqlContext */
type GqlContext = {
  db: { getSortedFriends(id: number, order: string): User };
};
```
