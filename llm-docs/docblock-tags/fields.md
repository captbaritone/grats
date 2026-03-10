# Fields

You can define GraphQL fields by placing a `@gqlField` directly before a:

-   Method declaration
-   Method signature
-   Property declaration
-   Property signature
-   Parameter property
-   Static method
-   Function declaration
-   Arrow function declaration

> **TIP:**
> For defining fields on the root types `Query`, `Mutation` or `Subscription`, see [Root Fields](./root-fields.md).

## Class-based fields

When using classes or interfaces to define GraphQL types, fields can be defined using class properties or methods:

```tsx
/** @gqlType */
class User {
  /**
   * A description of some field.
   * @gqlField
   */
  someField: string;

  /** @gqlField */
  myField(): string {
    return "Hello World";
  }
}
```

Fields can also be defined using TypeScript's [parameter properties](https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties), which is a short-hand for defining a field value that is passed to the class constructor:

```tsx
/** @gqlType */
class User {
  constructor(
    /** @gqlField */
    public name: string,
  ) {}
}
```

For more information about field resolves, see [Resolver Signature](../resolvers.md).

## Functional style fields

If you prefer to avoid classes, types can be defined using type literals. However, this approach does not allow you to define derived/resolver fields. To solve this, Grats also allows you to **define derived fields using named, exported functions**. Function resolvers:

-   Accept an instance of the parent type as the first argument
-   Have a return type that matches the field type
-   Are exported named functions where the function name is the desired field name

```typescript
/** @gqlType */
const User = {
  /** @gqlField */
  firstName: string,
  /** @gqlField */
  lastName: string,
};

export function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}
```

Note that Grats will use the type of the first argument to determine which type is being extended. So, as seen in the previous examples, even if you don't need access to the instance you should still define a typed first argument.

## More field documentation

-   [Root Fields](./root-fields.md) for how to define fields on the root types
-   [Renaming](../resolvers/renaming.md) for how to expose your field under a different name than your function/property/method
-   [Field Arguments](./arguments.md) for how to define arguments
-   [Descriptions](../resolvers/descriptions.md) for how to add descriptions to your fields
-   [Nullability](../resolvers/nullability.md) for how to control the error handling and nullability of your field
-   [Deprecated](../resolvers/deprecated.md) for how to control the nullability of your field
