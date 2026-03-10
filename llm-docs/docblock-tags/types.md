# Types

GraphQL types can be defined by placing a `@gqlType` docblock directly before a:

-   Class declaration
-   Interface declaration
-   Type alias of a literal type or `unknown`

If model your GraphQL resolvers using classes, simply add a `@gqlType` docblock before the class containing that type's resolvers.

```tsx
/** @gqlType */
class MyClass {
  /** @gqlField */
  someField: string;
}
```

If your types are represented in your code by TypeScript interfaces, simply add a `@gqlType` docblock before the interface representing that type. Note that by using `@gqlType` on an interface, Grats will treat it as a GraphQL type and not an interface.

```tsx
/** @gqlType */
export interface MyType {
  /** @gqlField */
  someField: string;
}
```

Finally, if your types are represented in your code by named types, simply add a `@gqlType` docblock before the type alias which describes that type.

```tsx
/** @gqlType */
export type MyType = {
  /** @gqlField */
  someField: string;
};
```

## Renaming Types

If you want to use a different name for your type in GraphQL than in your code, you can specify the name of the type in the `@gqlType` docblock tag. See [Renaming](../resolvers/renaming.md) for more information.

```tsx
/** @gqlType User */
class UserModel {
  /** @gqlField */
  someField: string;
}
```

Which would extract:

```graphql
type User {
  someField: String
}
```

## Operation Types

In most cases you won't need to manually define the three operation types `Query`, `Mutation`, and `Subscription` since you can add fields to these types with the root field tags:

-   `@gqlQueryField`
-   `@gqlMutationField`
-   `@gqlSubscriptionField`

However, if you _do_ wish to explicitly define one of these types (for example to add a description) they _must_ be defined as a type alias of of `unknown`. E.g. `type Query = unknown;`. If you attempt to define them any other way, Grats will report an error. You can read more in this FAQ entry: [Why Prohibit Root Values](../faq/why-prohibit-root-values.md).

```tsx
/**
 * # Welcome to GenericCorp's GraphQL Schema!
 *
 * This is root type of our system. Everything you need can be access from here.
 * @gqlType
 */
type Query = unknown;

/** @gqlQueryField */
export function greet(): string {
  return "Hello world";
}
```

_Generated GraphQL schema:_

```graphql
"""
# Welcome to GenericCorp's GraphQL Schema!

This is root type of our system. Everything you need can be access from here.
"""
type Query {
  greet: String
}
```

## Implementing Interfaces

> **NOTE:**
> Like GraphQL's schema definition language, each type which implements of an interface must manually define all the fields required by the interface with `/** @gqlField */` tags. Grats will not automatically inherit the fields of the interface. If you omit any fields, or fail to match types correctly, Grats will report an error.

### Classes

If you are using classes to model your GraphQL resolvers, you can define your types as implementing a GraphQL interface by declaring that your class `implements` an interface which has been annotated with [`@gqlInterface`](./interfaces.md).

```tsx
/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
export class User implements Person {
  /** @gqlField */
  name: string;
}
```

Will generate the following GraphQL schema:

```graphql
interface Person {
  name: String
}

type User implements Person {
  name: String
}
```

### TypeScript Interface

If you are using interfaces to model your GraphQL resolvers, you can define your types as implementing a GraphQL interface by declaring that your class `extends` an interface which has been annotated with [`@gqlInterface`](./interfaces.md).

```tsx
/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
export interface User extends Person {
  __typename: "User";
  /** @gqlField */
  name: string;
}
```

Will generate the following GraphQL schema:

```graphql
interface Person {
  name: String
}

type User implements Person {
  name: String
}
```

#### Type Alias

Types declared using a type alias _may not_ implement a GraphQL interface. Instead, we recommend using a TypeScript interface to model your GraphQL type.

* * *

> **INFO:**
> See [Interfaces](./interfaces.md) for more information about defining interfaces.

> **NOTE:**
> Grats must be able to determine the typename of any type which implements an interface. To achieve this Grats will validate that all implementors of an interface either define a `__typename: "MyType" as const` property or are exported classes. Grats can use either to determin the typename at runtime.
