# Interfaces

GraphQL interfaces can be defined by placing a `@gqlInterface` docblock directly before an:

* Interface declaration

```ts
/**
 * A description of my interface.
 * @gqlInterface <optional name of the type, if different from class name>
 */
interface MyClass {
  /** @gqlField */
  someField: string;
}
```

## Implementing Interfaces

By defining a class which implements an interface annotated as `@gqlInterface`, Grats will automatically generate a GraphQL type which implements that interface.

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
If your type implements a GraphQL interface Grats will remind you to add a `__typename: "MyType"` property to your
class.
:::
