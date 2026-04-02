# Interfaces

GraphQL interfaces can be defined by placing a `@gqlInterface` docblock directly before an:

-   Interface declaration

```tsx
/**
 * A description of my interface.
 * @gqlInterface MyInterfaceName
 */
interface MyClass {
  /** @gqlField */
  someField: string;
}
```

## Shared Field Implementation

If you wish to define field which has a single implementation that is shared by all implementors, you can use the [function style of `@gqlField`](./fields.md#functional-style-fields) to define the field. This will automatically add the field to all implementors of the interface.

TypeScriptGraphQL

```tsx
/** @gqlInterface */
interface Greetable {
  /** @gqlField */
  name: string;
}

/** @gqlField */
export function greeting(thing: Greetable): string {
  return `Hello ${thing.name}!`;
}

/** @gqlType */
class User implements Greetable {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Pet implements Greetable {
  __typename: "Pet";
  /** @gqlField */
  name: string;
}
```

## Types Implementing Interfaces

To declare that a **type implements an interface**, see the [Implementing Interfaces](./types.md#implementing-interfaces) section of the Types docs.

## Interfaces Implementing Interfaces

To declare that an interface implements another interface, you can use TypeScript's `extends` keyword:

```tsx
/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface User extends Person {
  /** @gqlField */
  name: string;

  /** @gqlField */
  username: string;
}
```

Which will generate the following GraphQL schema:

```graphql
interface Person {
  name: String
}

interface User implements Person {
  name: String
  username: String
}
```

* * *

> **NOTE:**
> Each implementor of an interface must declare define all the fields required by the interface with `/** @gqlField */`. This means that if you have an interface that implements another interface, you must define all the fields required by both interfaces.

## Merged Interfaces

TypeScript [merges interfaces](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces) if you to define multiple interfaces with the same name in the same scope. For example, `Node` is a built-in interface that describes DOM nodes. So, if you define a `Node` interface in your code, TypeScript will merge your interface with the built-in one.

To avoid ambiguity, Grats will error if you try to define a GraphQL interface using a merged TypeScript interface. To avoid this error you can define a new interface, with a unique name, and then [rename](../resolvers/renaming.md) it to the name you want to use in your schema.

```tsx
import { ID } from "grats";

/** @gqlType Node */
interface GqlNode {
  /** @gqlField */
  id: ID;
}
```
