# Types

GraphQL types can be defined by placing a `@gqlType` docblock directly before a:

* Class declaration
* Interface declaration
* Type alias of a literal type


If model your GraphQL resolvers using classes, simply add a `@gqlType` docblock
before the class conaining that type's resolvers.

```ts
/**
 * Here I can write a description of my type that will be included in the schema.
 * @gqlType <optional name of the type, if different from class name>
 */
class MyClass {
  /** @gqlField */
  someField: string;
}
```

If youre types are represented in your code by interfaces, simply add a
`@gqlType` docblock before the interface representing that type. Note that by
using `@gqlType` on an interface, Grats will treat it as a GraphQL type and not
an interface.

```ts
/** @gqlType */
interface MyType {
  /** @gqlField */
  someField: string;
}
```

Finally, if your types are represented in your code by named types, simply add a
`@gqlType` docblock before the type alias which describes that type.

```ts
/** @gqlType */
type MyType = {
  /** @gqlField */
  someField: string;
}
```

## Implementing Interfaces

If you are using classes to model your GraphQL resolvers, you can define your types as implementing a GraphQL interface by declaring that your class implements an interface which has been annotated with [`@gqlInterface`](./04-interfaces.md).


:::caution

Grats does not **yet** support implementing interfaces when you define your types using interfaces of type aliases, but support is on our roadmap.

:::

```ts
/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements Person {
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



:::note
If your type implements a GraphQL interface or is a member of a GraphQL
union, Grats will remind you to add a `__typename: "MyType"` property to your
class, type or interface.
:::
