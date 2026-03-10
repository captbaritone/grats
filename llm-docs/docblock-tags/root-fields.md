# Root Fields

For the root types `Query`, `Mutation` or `Subscription`, you can define GraphQL fields using the following docblock tags:

-   `@gqlQueryField`
-   `@gqlMutationField`
-   `@gqlSubscriptionField`

These tags may be placed before a:

-   Static method
-   Function declaration
-   Arrow function declaration

> **TIP:**
> For defining fields on non-root types, see [Fields](./fields.md).

## Class-based root fields

If you want to group root fields that return or modify a specific type with that type's backing class, you can define them as part of that type's class using static methods:

```tsx
/** @gqlType */
export class User {
  constructor(
    /** @gqlField */
    public name: string,
  ) {}

  /** @gqlQueryField */
  static me(): User {
    return new User("Elizabeth");
  }
}
```

_Generated GraphQL schema:_

```graphql
type Query {
  me: User
}

type User {
  name: String
}
```

For more information about field resolves, see [Resolver Signature](../resolvers.md).

## Functional style root fields

If you prefer to avoid classes Grats also allows you to **define root fields using named, exported functions**. Function resolvers:

-   Have a return type that matches the field type
-   Are exported named functions where the function name is the desired field name

#### Extending Query:

```tsx
const DB: any = {};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlQueryField */
export function userById(id: string): User {
  return DB.getUserById(id);
}
```

#### Extending Mutation:

```tsx
const DB: any = {};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlMutationField */
export function deleteUser(id: string): boolean {
  return DB.deleteUser(id);
}
```

> **TIP:**
> Defining fields on these root types will cause the type to automatically be added to your schema. If you want to explicitly define one or more of these root types, for example to add a description, see [Operation Types](./types.md#operation-types).

## More field documentation

-   [Renaming](../resolvers/renaming.md) for how to expose your field under a different name than your function/property/method
-   [Field Arguments](./arguments.md) for how to define arguments
-   [Descriptions](../resolvers/descriptions.md) for how to add descriptions to your fields
-   [Nullability](../resolvers/nullability.md) for how to control the error handling and nullability of your field
-   [Deprecated](../resolvers/deprecated.md) for how to control the nullability of your field
